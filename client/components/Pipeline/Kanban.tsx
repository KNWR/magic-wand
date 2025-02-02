import React, { PureComponent } from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import styled from 'styled-components';
import { Paginated } from '@feathersjs/feathers';
import client from '../../lib/client';
import transformData from '../../lib/pipelineUtils';
import {
  Status,
  archivedStates,
  companySchema,
  Company,
} from '../../schemas/company';
import Column from './Column';
import CustomDropdown from './Dropdown';
import GroupButton from './GroupButton';
import IndividualButton from './IndividualButton';
import { DocumentTypes } from '../../schemas/gdrive';
import { User } from '../../schemas/user';

const companyPartialSchema = {
  type: companySchema.type,
  required: companySchema.required,
  properties: {},
};

/*
 * Create a partial schema that is used for the react-json form. It grabs all the required properties
 * from the actual schema.
 */
companyPartialSchema.required.forEach((property) => {
  companyPartialSchema.properties[property] =
    companySchema.properties[property];
});

const formData = {
  status: 'applied',
};

const AppContainer = styled.div`
  display: flex;
`;

interface KanbanProps {
  user: User;
}

interface KanbanState {
  isLoading: boolean /* True if we are still grabbing data from api */;
  columns: Record<string, any>;
  columnOrder: string[];
  partnerNames: Set<string>;
}

export default class Kanban extends PureComponent<KanbanProps, KanbanState> {
  state = {
    isLoading: true,
    columns: {},
    columnOrder: [],
    partnerNames: new Set([]),
  };

  async componentDidMount() {
    try {
      /* Get all companies that are not in archived state */
      const res = (await client.service('api/companies').find({
        query: {
          status: {
            $nin: archivedStates,
          },
          $eager: 'pointPartners',
        },
      })) as Paginated<Company>;
      const ret = transformData(res.data);
      this.setState({
        columnOrder: ret.columnOrder,
        columns: ret.columns,
        partnerNames: ret.partnerNames,
        isLoading: false,
      });
    } catch (error) {
      console.error(error);
    }
  }

  onDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const home = this.state.columns[source.droppableId];
    const foreign = this.state.columns[destination.droppableId];

    /** **************************************
     re-ordering within same column
     **************************************** */
    if (home === foreign) {
      const obj = home.companies[source.index];
      home.companies.splice(source.index, 1);
      home.companies.splice(destination.index, 0, obj);

      const newHome = {
        ...home,
      };

      const newColumns = this.state.columns;
      newColumns[source.droppableId] = newHome;

      const newState = {
        columns: newColumns,
      };

      this.setState(newState);
      return;
    }

    /** **************************************
     moving from one list to another
     ************************************ */

    /*
     * Find the column the company with this id and remove it.
     */
    let draggedObj;
    home.companies.forEach((companyObj, index) => {
      if (companyObj.id === draggableId) {
        draggedObj = companyObj;
        home.companies.splice(index, 1);
      }
    });

    const newHome = {
      ...home,
    };

    /*
     * Add the companyObj to the Destinations.
     */
    foreign.companies.splice(destination.index, 0, draggedObj);

    const newForeign = {
      ...foreign,
    };

    /*
     * Update the database with the new status of the company.
     * Note that draggableId is equivalent to the companyID.
     */
    try {
      client.service('api/companies').patch(draggableId, {
        status: newForeign.id,
      });
    } catch (e) {
      console.error(e);
    }

    const newState = {
      columns: {
        ...this.state.columns,
        [newHome.id]: newHome,
        [newForeign.id]: newForeign,
      },
    };

    this.setState(newState);
  };

  render() {
    return (
      <div>
        <h2>{`${this.props.user.firstName} ${this.props.user.lastName}`}</h2>
        <div className="pipelineButtons">
          <CustomDropdown partners={this.state.partnerNames} />
          <IndividualButton
            loggedInPartnerName={`${this.props.user.firstName} ${
              this.props.user.lastName
            }`}
          />
          <GroupButton />
        </div>
        {this.state.isLoading ? (
          <div> Loading </div>
        ) : (
          <div>
            <DragDropContext onDragEnd={this.onDragEnd}>
              <AppContainer className="pipelineColumns">
                {this.state.columnOrder.map((columnId) => {
                  const column = this.state.columns[columnId];
                  return (
                    <Column
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      companies={column.companies}
                    />
                  );
                })}
                <div className="addCompanyDiv">
                  <a
                    href="https://dormroomfund.typeform.com/to/H90ZNU"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <img src="/static/Add_Company_Button.png" />
                  </a>
                </div>
              </AppContainer>
            </DragDropContext>
          </div>
        )}
      </div>
    );
  }
}
