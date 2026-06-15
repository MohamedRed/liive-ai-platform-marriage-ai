import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/config-global';
import { HijraEditView } from 'src/sections/hijra/view';
import { LoadingScreen } from 'src/components/loading-screen';
import { NotFoundView } from 'src/sections/error/not-found-view';

// Types
import type { IHijraItem } from '@livve-1/database-types';

// Firestore service
import { hijraFirestore } from 'src/services/firebase/hijra';

// ----------------------------------------------------------------------

const metadata = { title: `Edit Hijra Package | Dashboard - ${CONFIG.site.name}` };

export default function Page() {
  const { id = '' } = useParams();
  const [currentPackage, setCurrentPackage] = useState<IHijraItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchPackage = async () => {
      try {
        setLoading(true);
        if (id) {
          const data = await hijraFirestore.getPackageById(id);
          setCurrentPackage(data);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching Hijra package:', err);
        setError('Failed to load package details');
      } finally {
        setLoading(false);
      }
    };

    fetchPackage();
  }, [id]);

  // Show loading screen while fetching data
  if (loading) {
    return <LoadingScreen />;
  }

  // Show 404 if package not found
  if (!currentPackage) {
    return <NotFoundView />;
  }
  
  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      <HijraEditView hijraPackage={currentPackage} />
    </>
  );
} 