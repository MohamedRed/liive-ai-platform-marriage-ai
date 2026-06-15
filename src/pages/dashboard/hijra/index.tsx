import { Navigate } from 'react-router-dom';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

export default function Index() {
  return <Navigate to={paths.dashboard.hijra.root} />;
} 