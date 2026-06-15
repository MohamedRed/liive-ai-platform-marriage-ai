import { Helmet } from 'react-helmet-async';

import { CONFIG } from 'src/config-global';

import {AssistantView} from "../../../sections/assistant/view";

// ----------------------------------------------------------------------

const metadata = { title: `Chat | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <AssistantView />
    </>
  );
}
