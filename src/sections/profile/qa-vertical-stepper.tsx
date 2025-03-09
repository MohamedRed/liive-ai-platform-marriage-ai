import {doc, updateDoc, serverTimestamp, DocumentData} from "firebase/firestore";
import {useState, useEffect, useCallback} from 'react';
import {useFirestore, useFirestoreDocData} from "reactfire";
import { Box } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { Timestamp } from '@firebase/firestore-types';

import Step from '@mui/material/Step';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import StepLabel from '@mui/material/StepLabel';
import TextField from "@mui/material/TextField";
import Typography from '@mui/material/Typography';
import StepContent from '@mui/material/StepContent';
import {Accordion, AccordionDetails, AccordionSummary} from "@mui/material";

import {useAuthContext} from "../../auth/hooks";
import {Iconify} from "../../components/iconify";
import { 
  COLLECTIONS, 
  QuestionsAnswers,
  QAEditLogs,
  Timestamping
} from '../../../packages/database-types/src';

// ----------------------------------------------------------------------

interface GroupedQAsBySection {
  [key: string]: Array<{
    id: string;
    question: string;
    answer: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
  }>;
}

// ----------------------------------------------------------------------

export function QAVerticalStepper() {
  const {user} = useAuthContext();
  const firestore = useFirestore();

  if (!user) {
    return <Paper sx={{ p: 3, textAlign: 'center' }}>Loading user profile...</Paper>;
  }
  
  // Get real-time updates for the questions and answers document
  const qaRef = doc(firestore, COLLECTIONS.QUESTIONS_ANSWERS, user?.id || 'dummy');
  const { status, data: qaData } = useFirestoreDocData<DocumentData>(qaRef);

  const [activeStep, setActiveStep] = useState(0);
  const [groupedQAs, setGroupedQAs] = useState<GroupedQAsBySection>({});

  const [controlled, setControlled] = useState<string | false>(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [changedAnswers, setChangedAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState<Record<string, boolean>>({});

  const handleChangeControlled =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setControlled(isExpanded ? panel : false);
    };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  // Initialize local answers from Q&A data
  useEffect(() => {
    if (qaData?.questions) {
      const answers: Record<string, string> = {};
      Object.entries(qaData.questions as QuestionsAnswers['questions']).forEach(([id, qa]) => {
        answers[id] = qa.answer || '';
      });
      setLocalAnswers(answers);
    }
  }, [qaData?.questions]);

  const handleAnswerChange = (questionId: string, newAnswer: string) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
    
    // Normalize whitespace: trim and replace multiple spaces with single space
    const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');
    
    const originalAnswer = (qaData?.questions as QuestionsAnswers['questions'])?.[questionId]?.answer || '';
    const hasRealChange = 
      normalizeText(newAnswer) !== normalizeText(originalAnswer) && 
      normalizeText(newAnswer) !== '';
    
    if (hasRealChange) {
      setChangedAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
    } else {
      setChangedAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleSaveAnswer = async (questionId: string) => {
    const newAnswer = localAnswers[questionId];
    setSavingAnswers(prev => ({ ...prev, [questionId]: true }));
    
    try {
      // Update the answer in questions
      await updateDoc(qaRef, {
        [`questions.${questionId}.answer`]: newAnswer,
        [`questions.${questionId}.updatedAt`]: serverTimestamp(),
      });

      // Create QA edit log
      const editLogRef = doc(firestore, COLLECTIONS.QA_EDIT_LOGS);
      const editLog: Omit<QAEditLogs, 'id'> = {
        userId: user.id,
        questionId: questionId,
        previousAnswer: (qaData?.questions as QuestionsAnswers['questions'])?.[questionId]?.answer || '',
        newAnswer: newAnswer,
        createdAt: serverTimestamp() as unknown as Timestamp,
        metadata: {
          deviceInfo: 'Web Browser',
          location: {
            country: 'US' // TODO: Get actual country
          }
        }
      };
      await updateDoc(editLogRef, editLog);

      // Add artificial delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      setChangedAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (error) {
      console.error('Error updating answer:', error);
    } finally {
      setSavingAnswers(prev => ({ ...prev, [questionId]: false }));
    }
  };

  function groupQAsBySection(questionsAnswers: QuestionsAnswers['questions'] = {}): GroupedQAsBySection {
    // First group QAs by section
    const grouped = Object.entries(questionsAnswers).reduce<GroupedQAsBySection>((grouped, [key, qa]) => {
      const section = qa.section || "uncategorized";
      
      if (!grouped[section]) {
        grouped[section] = [];
      }
      
      grouped[section].push({
        id: key,
        question: qa.question,
        answer: qa.answer,
        createdAt: qa.createdAt,
        updatedAt: qa.updatedAt
      });

      return grouped;
    }, {});

    // Sort QAs within each section by timestamp
    Object.values(grouped).forEach(qas => {
      qas.sort((a, b) => {
        const timeA = a.createdAt.toMillis();
        const timeB = b.createdAt.toMillis();
        return timeA - timeB;
      });
    });

    // Convert to array of [section, qas] pairs and sort by earliest question in each section
    const sortedEntries = Object.entries(grouped).sort(([, qasA], [, qasB]) => {
      const timeA = qasA[0].createdAt.toMillis();
      const timeB = qasB[0].createdAt.toMillis();
      return timeA - timeB;
    });

    // Convert back to object
    return Object.fromEntries(sortedEntries);
  }

  useEffect(() => {
    if (qaData) {
      // Handle missing or malformed questions
      const questions = (qaData.questions || {}) as QuestionsAnswers['questions'];
      setGroupedQAs(groupQAsBySection(questions));
    }
  }, [qaData]);

  // Add empty state handling
  const hasQAs = Object.keys(groupedQAs).length > 0;

  useEffect(() => {
    const handleScroll = (event: CustomEvent) => {
      const { section, questionId } = event.detail;
      // Find and scroll to the section/question
      // You might need to use refs or element IDs
      const element = document.querySelector(`[data-section="${section}"][data-question="${questionId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 2000);
      }
    };

    window.addEventListener('scrollToQuestion', handleScroll as EventListener);
    return () => window.removeEventListener('scrollToQuestion', handleScroll as EventListener);
  }, []);

  return (
    <>
      {status === 'loading' ? (
        <span>loading...</span>
      ) : (
        <>
          {!hasQAs && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1">
                No questions and answers have been added to this profile yet.
              </Typography>
            </Paper>
          )}

          {hasQAs && Object.entries(groupedQAs).map(([section, qas]) => (
            <Accordion 
              key={section}
              expanded={controlled === section}
              onChange={handleChangeControlled(section)}
              sx={{ p: 2, bgcolor: 'background.paper', gap: 0 }}
            >
              <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                <Typography variant="subtitle1">{section}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stepper activeStep={activeStep} orientation="vertical">
                  {qas.map((qa) => (
                    <Step 
                      active 
                      key={qa.id}
                      data-section={section}
                      data-question={qa.id}
                    >
                      <StepLabel>{qa.question}</StepLabel>
                      <StepContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <TextField
                            variant="outlined"
                            rows={5}
                            fullWidth
                            multiline
                            label="Answer"
                            value={localAnswers[qa.id] || ''}
                            onChange={(e) => handleAnswerChange(qa.id, e.target.value)}
                          />
                          <LoadingButton
                            loading={savingAnswers[qa.id]}
                            disabled={!changedAnswers[qa.id]}
                            variant="contained"
                            color="primary"
                            onClick={() => handleSaveAnswer(qa.id)}
                            sx={{ alignSelf: 'center', minWidth: 100 }}
                          >
                            Save
                          </LoadingButton>
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </>
  );
}
