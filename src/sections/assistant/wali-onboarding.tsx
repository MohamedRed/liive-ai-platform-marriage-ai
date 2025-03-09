import type {StepIconProps} from "@mui/material/StepIcon";

import {firstValueFrom} from "rxjs";
import {doc, getDoc} from "firebase/firestore";
import {httpsCallable} from "rxfire/functions";
import {m, AnimatePresence} from "framer-motion";
import {useFirestore, useFunctions} from "reactfire";
import {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import Step from "@mui/material/Step";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stepper from "@mui/material/Stepper";
import {styled} from "@mui/material/styles";
import StepLabel from "@mui/material/StepLabel";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import StepConnector, {stepConnectorClasses} from "@mui/material/StepConnector";

import {Iconify} from "src/components/iconify";

import {useParams} from "../../routes/hooks";
import {signOut} from "../../auth/context/firebase";
import {PhoneNumberVerification} from "./phone-number-verification";

import type {WaliProfileType} from "./wali-create-form";

// ----------------------------------------------------------------------

const QontoConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 10,
    left: "calc(-50% + 16px)",
    right: "calc(50% + 16px)",
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.vars.palette.success.main },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.vars.palette.success.main },
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderRadius: 1,
    borderTopWidth: 3,
    borderColor: theme.vars.palette.divider,
  },
}));

function QontoStepIcon(props: StepIconProps) {
  const { active, completed, className } = props;

  return (
    <QontoStepIconRoot ownerState={{ active }} className={className}>
      {completed ? (
        <Iconify
          icon="eva:checkmark-fill"
          className="QontoStepIcon-completedIcon"
          width={24}
          height={24}
        />
      ) : (
        <div className="QontoStepIcon-circle" />
      )}
    </QontoStepIconRoot>
  );
}

const QontoStepIconRoot = styled("div")<{
  ownerState: { active?: boolean };
}>(({ theme, ownerState }) => ({
  height: 22,
  display: "flex",
  alignItems: "center",
  color: theme.vars.palette.text.disabled,
  ...(ownerState.active && { color: theme.vars.palette.success.main }),
  "& .QontoStepIcon-completedIcon": {
    zIndex: 1,
    fontSize: 18,
    color: theme.vars.palette.success.main,
  },
  "& .QontoStepIcon-circle": {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "currentColor",
  },
}));

export function WaliOnboarding() {
  const { id: waliProfileId } = useParams();
  const functions = useFunctions();
  const firestore = useFirestore();

  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isWaliConfirmed, setIsWaliConfirmed] = useState<null | boolean>(null);

  // Check if the app is in test mode
  const isTestMode = process.env.NODE_ENV === "development";

  const logoutCurrentUser = useCallback(async () => {
    if (isTestMode) {
      try {
        await signOut();
        console.log("Successfully logged out in test mode.");
      } catch (error) {
        console.error("Error during logout in test mode:", error);
      }
    }
  }, [isTestMode]);

  useEffect(() => {
    logoutCurrentUser();
  }, [logoutCurrentUser]);

  const fetchPhoneNumber = useCallback(async () => {
    try {
      if (!waliProfileId) throw new Error("Wali Profile ID is missing in the URL.");
      const waliDoc = await getDoc(doc(firestore, "WALIS", waliProfileId));
      if (!waliDoc.exists()) {
        throw new Error("Wali profile not found.");
      }
      const waliProfile = waliDoc.data() as WaliProfileType
      setPhoneNumber(waliProfile.initialInformation.phoneNumber);
    } catch (error) {
      console.error("Error fetching phone number:", error);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, waliProfileId]);

  const fetchVerificationUrl = useCallback(async () => {
    try {
      const remoteCreateVerificationSession = httpsCallable(
        functions,
        "createVerificationSession"
      );
      const { clientSecret, url } = await firstValueFrom(
        remoteCreateVerificationSession({})
      );
      setVerificationUrl(url);
    } catch (error) {
      console.error("Error fetching verification URL:", error);
      setVerificationUrl(""); // Clear URL on failure
    }
  }, [functions]);

  const verifyWaliStatus = useCallback(async () => {
    try {
      const remoteIsWali = httpsCallable(functions, "isWali");
      const { result } = await firstValueFrom(remoteIsWali({}));
      setIsWaliConfirmed(result);
      if (!result) throw new Error("The Wali verification failed.");
    } catch (error) {
      console.error("Error verifying Wali status:", error);
      setIsWaliConfirmed(false);
    }
  }, [functions]);

  useEffect(() => {
    fetchPhoneNumber();
  }, [fetchPhoneNumber]);

  const handleNext = async () => {
    if (activeStep === 0) {
      await fetchVerificationUrl(); // Fetch URL after phone verification
    }
    if (activeStep === 1) {
      await verifyWaliStatus();
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const renderVerification = (
    <Box sx={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", padding: 2 }}>
      {isLoading ? (
        <LinearProgress />
      ) : (
        <iframe
          title="verificationSession"
          src={verificationUrl}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: "8px" }}
        />
      )}
    </Box>
  );

  const renderPhoneVerification = (
    <PhoneNumberVerification
      prefilledPhoneNumber={phoneNumber}
      onVerificationSuccess={handleNext}
    />
  );

  const renderWaliVerification = (
    <Box sx={{ width: "100%", textAlign: "center", padding: 3 }}>
      {isWaliConfirmed === null ? (
        <LinearProgress />
      ) : isWaliConfirmed ? (
        <Alert severity="success">Wali verification successful!</Alert>
      ) : (
        <Alert severity="error">Wali verification failed. Please contact support.</Alert>
      )}
    </Box>
  );

  const STEPS = [
    { title: "Phone Verification", content: renderPhoneVerification },
    { title: "Identity Verification", content: renderVerification },
    { title: "Confirm Wali Status", content: renderWaliVerification },
  ];

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Typography variant="h4" sx={{ textAlign: "center", margin: 3 }}>
        Wali Onboarding
      </Typography>
      <Stepper alternativeLabel activeStep={activeStep} connector={<QontoConnector />}>
        {STEPS.map((step) => (
          <Step key={step.title}>
            <StepLabel StepIconComponent={QontoStepIcon}>{step.title}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <AnimatePresence mode="wait">
        <Box
          component={m.div}
          key={activeStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.5 }}
          sx={{ flexGrow: 1, padding: 3 }}
        >
          <Paper sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
            {STEPS[activeStep]?.content}
          </Paper>
        </Box>
      </AnimatePresence>
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          padding: 2,
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #ddd",
          backgroundColor: "white",
        }}
      >
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={isWaliConfirmed === false && activeStep === 2}
        >
          {activeStep === STEPS.length - 1 ? "Finish" : "Next"}
        </Button>
      </Box>
    </Box>
  );
}
