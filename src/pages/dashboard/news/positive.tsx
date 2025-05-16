import { Helmet } from 'react-helmet-async';

import { NewsListView } from 'src/sections/news/view';

// ----------------------------------------------------------------------

export default function PositiveNewsPage() {
  return (
    <>
      <Helmet>
        <title>Positive News</title>
      </Helmet>

      <NewsListView />
    </>
  );
} 