import type {ConfirmationResult} from "firebase/auth";

import {z as zod} from "zod";
import {useForm} from "react-hook-form";
import {useState, useEffect} from "react";
import {zodResolver} from "@hookform/resolvers/zod";
import {parsePhoneNumber} from "react-phone-number-input";
import {getAuth, RecaptchaVerifier, signInWithPhoneNumber} from "firebase/auth";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";

import {Form, Field} from "src/components/hook-form";

import {EmailInboxIcon} from "../../assets/icons";

// ----------------------------------------------------------------------

export type VerifySchemaType = zod.infer<typeof VerifySchema>;

export const VerifySchema = zod.object({
  code: zod
    .string()
    .min(1, { message: "Code is required!" })
    .min(6, { message: "Code must be at least 6 characters!" }),
  phoneNumber: zod
    .string()
    .min(1, { message: "Phone number is required!" })
    .refine((phone) => /^\+?[1-9]\d{1,14}$/.test(phone), {
      message: "Phone number must be in E.164 format!",
    }),
});

type Props = {
  prefilledPhoneNumber: string;
  onVerificationSuccess: () => void;
};

// ----------------------------------------------------------------------

export function PhoneNumberVerification({
                                          prefilledPhoneNumber,
                                          onVerificationSuccess,
                                        }: Props) {
  const auth = getAuth();

  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneInputKey, setPhoneInputKey] = useState<number>(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult>();

  const methods = useForm<VerifySchemaType>({
    resolver: zodResolver(VerifySchema),
    defaultValues: {
      phoneNumber: prefilledPhoneNumber || "",
      code: "",
    },
  });

  const { handleSubmit, reset, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (prefilledPhoneNumber) {
      const parsedPhoneNumber = parsePhoneNumber(prefilledPhoneNumber);
      if (parsedPhoneNumber) {
        reset({ phoneNumber: parsedPhoneNumber.number, code: "" });
        setPhoneInputKey((prevKey) => prevKey + 1); // Force re-render of PhoneInput
      }
    }
  }, [prefilledPhoneNumber, reset]);

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          console.log("Recaptcha solved");
        },
        "expired-callback": () => {
          setErrorMessage("Recaptcha expired. Please try again.");
        },
      });
    }
  }, [auth]);

  const sendVerificationCode = async (phoneNumber: string) => {
    setIsSendingCode(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const appVerifier = window.recaptchaVerifier;
      const _confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(_confirmationResult);
      setVerificationId(_confirmationResult.verificationId);
      setSuccessMessage("Verification code sent successfully!");
    } catch (error) {
      console.error("Error sending verification code:", error);
      setErrorMessage(() => {
        switch (error?.code) {
          case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";
          default:
            return "Failed to send verification code. Please check the phone number and try again.";
        }
      });

    } finally {
      setIsSendingCode(false);
    }
  };

  useEffect(() => {
    if (prefilledPhoneNumber) {
      sendVerificationCode(prefilledPhoneNumber);
    }
  }, [prefilledPhoneNumber]);

  const verifyCode = async (data: VerifySchemaType) => {
    if (!verificationId) {
      setErrorMessage("Verification code has not been sent.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const userCredential = await confirmationResult?.confirm(data.code);
      setSuccessMessage("Phone number verified successfully!");
      console.log("Logged in user:", userCredential.user);
      onVerificationSuccess();
    } catch (error) {
      console.error("Error verifying code:", error);
      setErrorMessage(() => {
        switch (error?.code) {
          case "auth/invalid-verification-code":
            return "The verification code is invalid. Please try again.";
          default:
            return "Failed to send verification code. Please check and try again.";
        }
      });
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    await verifyCode(data);
  });

  const renderHead = (
    <>
      <EmailInboxIcon sx={{ mx: "auto" }} />
      <Stack spacing={1} sx={{ mb: 5, textAlign: "center", whiteSpace: "pre-line" }}>
        <Typography variant="h5">Verify Your Phone Number</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {`We've sent a 6-digit verification code to your phone number. \nPlease enter the code below to verify your phone.`}
        </Typography>
      </Stack>
    </>
  );

  const renderForm = (
    <Stack spacing={3}>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      {successMessage && <Alert severity="success">{successMessage}</Alert>}
      <Field.Phone
        key={phoneInputKey}
        name="phoneNumber"
        label="Phone Number"
        placeholder="+1234567890"
        InputLabelProps={{ shrink: true }}
        disabled={Boolean(prefilledPhoneNumber)}
      />

      <Field.Code name="code" label="Verification Code" placeholder="123456" />

      <LoadingButton
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting || isSendingCode}
        loadingIndicator={isSendingCode ? "Sending code..." : "Verifying..."}
      >
        Verify
      </LoadingButton>
    </Stack>
  );

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
        padding: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div id="recaptcha-container" />
      {renderHead}
      <Form methods={methods} onSubmit={onSubmit}>
        {renderForm}
      </Form>
    </Box>
  );
}
