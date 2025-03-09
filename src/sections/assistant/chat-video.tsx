// eslint-disable-next-line import/no-extraneous-dependencies
import {shuffle} from "lodash";
import {m} from "framer-motion";
// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
// eslint-disable-next-line import/no-extraneous-dependencies
import {useState, useCallback, useEffect} from "react";
import {useTheme} from "@mui/material/styles";
import {PreJoin, VideoConference} from "@livekit/components-react";
import {LiveKitRoom} from "@livekit/components-react";
import {httpsCallable} from "rxfire/functions";
import {firstValueFrom} from "rxjs";
import {useFunctions} from "reactfire";
import {LikekitTokenResponse} from "./view";


// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean
  onClose: () => void;
}

export function ChatVideo({isOpen, onClose}: Props) {
  const theme = useTheme();

  const functions = useFunctions()

  const [isLoading, setIsLoading] = useState(true);

  const [verificationUrl, setVerificationUrl] = useState("");

  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  const [livekitToken, setLivekitToken] = useState<string>(null)
  const [livekitUrl, setLivekitUrl] = useState<string>(null)
  const getLikekitToken = useCallback(async () => {
    const remoteLivekitToken = httpsCallable(functions, 'livekitToken');
    const {
      accessToken,
      url
    } = await firstValueFrom(remoteLivekitToken({})) as LikekitTokenResponse;
    setLivekitToken(accessToken)
    setLivekitUrl(url)
  }, [functions])

  useEffect(() => {
    getLikekitToken();
  }, [getLikekitToken])

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ease: 'easeOut', duration: 0.4}}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              {!hasJoinedRoom && <PreJoin onSubmit={() => setHasJoinedRoom(true)}/>}
              {hasJoinedRoom &&
                <LiveKitRoom serverUrl={livekitUrl} token={livekitToken} audio video style={{display: "contents"}}>
                <VideoConference/>
              </LiveKitRoom>}
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}
