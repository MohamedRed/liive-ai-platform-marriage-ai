// eslint-disable-next-line import/no-extraneous-dependencies
import {shuffle} from "lodash";
// eslint-disable-next-line import/no-extraneous-dependencies
import {Sheet} from "react-modal-sheet";
// eslint-disable-next-line import/no-extraneous-dependencies
import {useState, useEffect} from "react";

import {useTheme} from "@mui/material/styles";

import {WaliCreateForm} from "./wali-create-form";


// ----------------------------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
}

const spring = {
  type: "spring",
  damping: 100,
  stiffness: 150
};

export function WaliCreateView({isOpen, onClose}: Props) {
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);

  const [verificationUrl, setVerificationUrl] = useState("");

  const [randomArray, setRandomArray] = useState([1, 2, 3, 4, 5]);

  useEffect(() => {
    setTimeout(() => {
      setRandomArray(shuffle(randomArray));
    }, 3000);
  }, [randomArray]);

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
              <WaliCreateForm/>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}
