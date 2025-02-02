import React from 'react';
import Col from 'react-bootstrap/lib/Col';
import Row from 'react-bootstrap/lib/Row';
import Archive from '../components/Archive/Archive';
import PipelineLayout from '../components/Layout/PipelineLayout';
import { requireLoggedIn } from '../lib/routing';

const ArchivePage = () => (
  <PipelineLayout>
    <Row>
      <Col>
        <Archive />
      </Col>
    </Row>
  </PipelineLayout>
);

ArchivePage.getInitialProps = requireLoggedIn();

export default ArchivePage;
