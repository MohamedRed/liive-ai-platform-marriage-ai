import React from 'react';
import { Helmet } from 'react-helmet-async';
import { BuilderAIView } from '../../sections/builder/view/builder-ai-view';
import { DashboardContent } from 'src/layouts/dashboard';

export default function BuilderPage() {
  return (
    <>
      <Helmet>
        <title>Builder AI | Create Your Own AI Apps</title>
      </Helmet>
      <DashboardContent>
        <BuilderAIView />
      </DashboardContent>
    </>
  );
} 