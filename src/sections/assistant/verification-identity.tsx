// eslint-disable-next-line import/no-extraneous-dependencies
import {firstValueFrom} from "rxjs";
import {useFunctions} from "reactfire";
// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
// eslint-disable-next-line import/no-extraneous-dependencies
import {httpsCallable} from "rxfire/functions";
import {useState, useEffect, useCallback} from "react";

import Stack from '@mui/material/Stack';
import LinearProgress from "@mui/material/LinearProgress";
import {SheetTweenConfig} from "react-modal-sheet/src/types";
import { IdentityVerification } from '@liive-marriage-ai/database-types';

// ----------------------------------------------------------------------

// const stripePromise = loadStripe('pk_test_qblFNYngBkEdjEZ16jxxoWSM');

interface CreateVerificationSessionResponse {
  clientSecret: string;
  url: string;
  sessionId: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function VerificationIdentity({ isOpen, onClose, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [sessionId, setSessionId] = useState<string>("");

  const functions = useFunctions();

  const fetchVerificationUrl = useCallback(async () => {
    const remoteCreateVerificationSession = httpsCallable(functions, 'createVerificationSession');
    const { url, sessionId } = await firstValueFrom(remoteCreateVerificationSession({})) as CreateVerificationSessionResponse;
    /* const stripe = await stripePromise;
    const {error} = await stripe!.verifyIdentity(clientSecret);
    if (error) console.log('[error]', error);
    else console.log('Verification submitted!'); */
    setVerificationUrl(url);
    setSessionId(sessionId);
  }, [functions]);

  useEffect(() => {
    fetchVerificationUrl();
  }, [fetchVerificationUrl]);

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ease: 'easeOut', duration: 0.4}}>
      <Sheet.Backdrop>
        <Sheet.Container>
          <Sheet.Header/>
          <Sheet.Content>
            {isLoading &&
              <Stack sx={{flex: '1 1 auto', position: 'relative'}}>
                <LinearProgress
                  color="inherit"
                  sx={{
                    top: 0,
                    left: 0,
                    width: 1,
                    height: 3,
                    borderRadius: 0,
                  }}
                />
              </Stack>}
            <iframe title="verificationSession" src={verificationUrl} style={{height: "100%", border: "none"}}
                    onLoad={() => setIsLoading(false)}/>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}
