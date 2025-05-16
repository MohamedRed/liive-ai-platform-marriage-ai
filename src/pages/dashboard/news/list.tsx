import { Helmet } from 'react-helmet-async';

import { NewsListView } from 'src/sections/news/view';

// ----------------------------------------------------------------------

export default function NewsListPage() {
  return (
    <>
      <Helmet>
        <title>News</title>
      </Helmet>

      <NewsListView />
    </>
  );
} 