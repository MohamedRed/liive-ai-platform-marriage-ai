// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
import {useTheme} from "@mui/material/styles";
import UserProfileView from "../profile/view/user-profile-view";


// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfile({isOpen, onClose}: Props) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <UserProfileView/>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}
