import { Helmet } from 'react-helmet-async';

import { NewsListView } from 'src/sections/news/view';

// ----------------------------------------------------------------------

export default function NegativeNewsPage() {
  return (
    <>
      <Helmet>
        <title>Negative News</title>
      </Helmet>

      <NewsListView />
    </>
  );
} 