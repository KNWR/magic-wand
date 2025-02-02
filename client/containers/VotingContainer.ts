import { Paginated } from '@feathersjs/feathers';
import { Container } from 'unstated';
import client from '../lib/client';
import { VoteFields } from '../lib/voting';
import { archivedStates, Company } from '../schemas/company';
import { Vote, VoteType } from '../schemas/vote';
import { UnreachableCaseError } from '../lib/errors';

export enum VotingStatus {
  DoingPrevote = 'doing-prevote',
  DoingFinalVote = 'doing-final-vote',
  AwaitingFinalization = 'awaiting-finalization',
  VotingFinalized = 'voting-finalized',
}

export interface VotingContainerState {
  companies: Record<number, Company>;
  votes: Record<number, Vote>;
}

/** Handles the data-flow and server interfacing for all votes occurring in a system. */
export default class VotingContainer extends Container<VotingContainerState> {
  state: VotingContainerState = {
    companies: {},
    votes: {},
  };

  constructor() {
    super();

    client.service('api/votes').on('created', async (vote: Vote) => {
      await this.retrieveCompany(vote.companyId);
    });
    client.service('api/votes').on('removed', async (vote: Vote) => {
      await this.retrieveCompany(vote.companyId);
    });
  }

  // GETTERS AND SETTERS
  // //////////////////////////////////////////////////////////////////////////////

  company(id: number): Company {
    return this.state.companies[id];
  }

  votingStatus(companyId: number, partnerId: number) {
    const company = this.company(companyId);
    if (!company) return VotingStatus.DoingPrevote;

    const didPrevote =
      company.partnerVotes.prevote &&
      company.partnerVotes.prevote.find((vote) => vote.partnerId === partnerId);
    const didFinalVote =
      company.partnerVotes.final &&
      company.partnerVotes.final.find((vote) => vote.partnerId === partnerId);
    const isFinalized = archivedStates.includes(company.status);

    if (didPrevote && didFinalVote) {
      if (!isFinalized) {
        return VotingStatus.AwaitingFinalization;
      } else {
        return VotingStatus.VotingFinalized;
      }
    } else if (didPrevote && !didFinalVote) {
      return VotingStatus.DoingFinalVote;
    } else if (!didPrevote && !didFinalVote) {
      return VotingStatus.DoingPrevote;
    }

    throw new Error('invalid voting state');
  }

  inVotingStatus(
    companyId: number,
    partnerId: number,
    ...statuses: VotingStatus[]
  ) {
    return statuses.includes(this.votingStatus(companyId, partnerId));
  }

  votedPartners(companyId: number, voteType: VoteType) {
    const company = this.state.companies[companyId];
    return company ? company.partnerVotes[voteType] : [];
  }

  vote(voteId: number) {
    return this.state.votes[voteId];
  }

  findVote(companyId: number, userId: number, voteType: VoteType) {
    const company = this.company(companyId);
    if (!company) {
      this.retrieveCompany(companyId);
      return undefined;
    }

    const votes = company.partnerVotes[voteType];
    const vote = votes && votes.find((v) => v.partnerId === userId);
    return vote && this.vote(vote.voteId);
  }

  // VOTING PROCESS
  // //////////////////////////////////////////////////////////////////////////////

  /** Prepare a company for voting. */
  async initialize(companyId: number) {
    const company = await client.service('api/companies').get(companyId);
    this.setState((state) => ({
      companies: {
        ...state.companies,
        [company.id]: company,
      },
    }));
  }

  /** Records a prevote. */
  async doPrevote(companyId: number, vote: VoteFields) {
    return await client.service('api/votes').create({
      ...vote,
      companyId,
      voteType: VoteType.Prevote,
    });
  }

  /** Records a final vote. */
  async doFinalVote(companyId: number, vote: VoteFields) {
    return await client.service('api/votes').create({
      ...vote,
      companyId,
      voteType: VoteType.Final,
    });
  }

  /** Finalizes votes. */
  async finalizeVotes(companyId: number) {
    const res = await client
      .service('api/votes/finalize')
      .patch(companyId, { voteType: 'final' });

    this.setState((state) => ({
      companies: {
        ...state.companies,
        [companyId]: {
          ...state.companies[companyId],
          status: res.status,
        },
      },
    }));

    this.retrieveCompany(companyId);

    alert(
      `This company was ${res.status}\n` +
        `Market Score: ${res.marketScoreAvg}\n` +
        `Fit Score: ${res.fitScoreAvg}\n` +
        `Product Score: ${res.productScoreAvg}\n` +
        `Team Score: ${res.teamScoreAvg}`
    );
  }

  /**
   * Delete votes. If a prevote is deleted, the final vote is deleted as well.
   * @param userId The ID of the current user. If the user deletes their own vote,
   *               allows them to recast it.
   */
  async deleteVote(voteId: number) {
    const vote = await client.service('api/votes').remove(voteId);
    await this.retrieveCompany(vote.companyId);

    // Delete the final vote as well if a prevote is deleted.
    if (vote.voteType === VoteType.Prevote) {
      const prevote = (await client.service('api/votes').find({
        query: {
          companyId: vote.companyId,
          partnerId: vote.partnerId,
          voteType: VoteType.Final,
        },
      })) as Paginated<Vote>;

      if (prevote.total > 0) {
        await Promise.all(
          prevote.data.map((pv) => client.service('api/votes').remove(pv.id))
        );
        await this.retrieveCompany(vote.companyId);
      }
    }
  }

  async retrieveCompany(companyId: number) {
    const company = await client.service('api/companies').get(companyId);
    this.setState((state) => ({
      companies: {
        ...state.companies,
        [company.id]: company,
      },
    }));

    return company;
  }

  async retrieveVote(voteId: number) {
    const votes = (await client.service('api/votes').find({
      query: {
        id: voteId,
        $eager: 'voter',
      },
    })) as Paginated<Vote>;
    const vote = votes.data[0];

    this.setState((state) => ({
      votes: {
        ...state.votes,
        [vote.id]: vote,
      },
    }));

    return vote;
  }

  async findAndRetrieveVote(
    companyId: number,
    userId: number,
    voteType: VoteType
  ) {
    const company =
      this.company(companyId) || (await this.retrieveCompany(companyId));

    const votes = company.partnerVotes[voteType];
    const vote = votes && votes.find((v) => v.partnerId === userId);

    return await this.retrieveVote(vote.voteId);
  }
}
