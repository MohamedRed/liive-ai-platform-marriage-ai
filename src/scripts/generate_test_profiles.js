import fs from 'fs'; // or use: const fs = require("fs"); if using CommonJS

// Sample lists for dummy data
const firstNamesMale = ["Ahmed", "Youssef", "Karim", "Hassan", "Mohamed"];
const firstNamesFemale = ["Aisha", "Laila", "Fatima", "Zahra", "Salma"];
const lastNames = ["El-Amin", "Benbrahim", "Garcia", "Fernandez", "Lopez", "Martinez"];
const cities = ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Bilbao"];
const waliRelations = ["father", "brother", "uncle"];

// Helper to choose a random element from an array
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Define the 52 questions (each with a sample answer basis)
const questionsList = [
  { question: "Describe your family environment growing up. What did you appreciate most and what was challenging?" },
  { question: "How important is your family’s opinion when evaluating a potential spouse?" },
  { question: "If your parents strongly disagreed with your choice of spouse for reasons you find unconvincing, how would you respond?" },
  { question: "Have you previously made major life decisions contrary to your family’s wishes? What was the outcome?" },
  { question: "How do you practice Islam daily (prayers, Qur’an reading, charity, etc.)?" },
  { question: "How crucial is your spouse’s level of religious observance to you?" },
  { question: "What aspects of Islam do you find challenging, or would you like to improve?" },
  { question: "If your spouse is more or less strict in religious practice than you, how would you handle disagreements?" },
  { question: "Do you expect your spouse to match your religious level exactly, or could they differ?" },
  { question: "What is your understanding of Mahr and its purpose in Islam?" },
  { question: "How flexible are you regarding the type and amount of Mahr?" },
  { question: "If you and your spouse disagree on Mahr, how should it be resolved?" },
  { question: "If you want a certain form of Mahr (money, gold, education) and your spouse disagrees, how do you approach a compromise?" },
  { question: "Are your views on Mahr flexibility consistent with how you’d handle a conflict about it?" },
  { question: "In your view, what are the primary responsibilities of a husband? A wife?" },
  { question: "Rate your willingness to adapt traditional gender roles if circumstances change (e.g., wife earning income, husband doing childcare)." },
  { question: "How should major household decisions be made—mutual consultation, husband as ‘qawwam’, extended family input, etc.?" },
  { question: "If you receive a great job offer in another city, but your spouse is hesitant, how would you handle it?" },
  { question: "Does your view on decision-making align with how you’d handle relocating for work?" },
  { question: "How do you typically handle stress or emotional challenges?" },
  { question: "How important is emotional expressiveness in a spouse?" },
  { question: "What forms of emotional or psychological support do you expect from your spouse?" },
  { question: "If your spouse shares a private marital issue with a friend, how would you address it?" },
  { question: "If you prefer privacy, how would you handle a spouse who needs frequent emotional conversations?" },
  { question: "What boundaries, if any, should exist between a married couple and their extended families?" },
  { question: "How comfortable are you with living in a joint family setup?" },
  { question: "How would you handle in-laws expecting cultural practices that conflict with your comfort or Islamic principles?" },
  { question: "Your spouse’s family wants you to follow a tradition you dislike. How do you respond?" },
  { question: "Are your stated boundaries consistent with your stance on extended family involvement?" },
  { question: "Describe your ideal financial arrangement (joint accounts, separate, hybrid). Why?" },
  { question: "How vital is financial transparency between spouses?" },
  { question: "If both spouses work, how should expenses, savings, and childcare be managed? If only one spouse works, how do you see the other’s role?" },
  { question: "If your spouse makes a large purchase without consulting you, how do you address it?" },
  { question: "Does your reaction to unauthorized purchases align with your stated financial arrangement ideal?" },
  { question: "Do you want children? If yes, how many and in what timeframe? If uncertain, what factors influence your decision?" },
  { question: "How central is it for you to raise children with strong Islamic values (e.g., Islamic schooling, memorizing Quran)?" },
  { question: "Which type of schooling do you prefer for children (Islamic, public, homeschooling) and why?" },
  { question: "If one spouse wants to move abroad for better opportunities but the other fears it would disrupt the children’s stability, how do you reconcile this?" },
  { question: "Are your aspirations for children consistent with your openness to relocating or trying different lifestyles?" },
  { question: "What are your thoughts on polygamy in Islam? Do you see it as a possibility?" },
  { question: "How crucial is transparency and mutual agreement if polygamy were considered?" },
  { question: "What are your views on divorce in Islam? Under what circumstances might it be necessary?" },
  { question: "If your spouse seriously proposes divorce, what steps would you take before finalizing it?" },
  { question: "Does your stance on polygamy align with how you’d handle marital conflicts or divorce?" },
  { question: "How do you view mental health challenges (anxiety, depression)? Are therapy or medication acceptable?" },
  { question: "How important is it that your spouse supports you (and vice versa) through mental or emotional struggles?" },
  { question: "What personal goals (spiritual, career, social) do you hope your spouse will actively support?" },
  { question: "If you notice your spouse showing signs of depression or spiritual apathy, how would you help them?" },
  { question: "Does your idea of ‘mutual support’ match the kind of help you’d actually provide in a crisis?" },
  { question: "Please list your top 5 priorities in a spouse (e.g., religious commitment, emotional intimacy, financial stability, family values). Rate each by importance (1–10)." },
  { question: "After covering these topics, do you feel differently about any issue now? Were there any surprises?" },
  { question: "Do you see any possible contradictions—like wanting financial freedom but also wanting a very involved extended family? How would you resolve that?" }
];

// Function to generate a dummy answer for a given question
function generateAnswer(question) {
  if (question.includes("family environment")) {
    return "I grew up in a warm and supportive environment, though balancing privacy and community expectations was sometimes challenging.";
  } if (question.includes("family’s opinion")) {
    return `${Math.floor(Math.random() * 10) + 1}`; // Random numeric rating between 1 and 10
  } if (question.includes("disagreed with your choice")) {
    return "I would respectfully explain my perspective and seek understanding.";
  } if (question.includes("major life decisions")) {
    return "Yes, and while it was challenging, it eventually led me to independence.";
  } if (question.includes("practice Islam daily")) {
    return "I strive to keep up with my prayers, Qur’an reading, and charity.";
  } if (question.includes("spouse’s level of religious observance")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } if (question.includes("aspects of Islam")) {
    return "I sometimes find balancing tradition and modern life challenging.";
  } if (question.includes("strict in religious practice")) {
    return "I believe mutual understanding and open dialogue are essential.";
  } if (question.includes("match your religious level exactly")) {
    return "I value compatibility and mutual respect above exact sameness.";
  } if (question.includes("Mahr")) {
    return question.includes("flexible") ? `${Math.floor(Math.random() * 10) + 1}` : "I see Mahr as a symbol of respect and security.";
  } if (question.includes("primary responsibilities")) {
    return "I believe a husband should provide and protect, and a wife should offer support and nurture, with room for modern roles.";
  } else if (question.includes("adapt traditional gender roles")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("household decisions")) {
    return "Decisions should be made jointly after thorough discussion.";
  } else if (question.includes("job offer in another city")) {
    return "I would balance career aspirations with family stability through open communication.";
  } else if (question.includes("relocating for work")) {
    return "Yes, my views are consistent with a balanced approach to life changes.";
  } else if (question.includes("handle stress") || question.includes("emotional challenges")) {
    return "I usually reflect and sometimes consult with trusted mentors.";
  } else if (question.includes("emotional expressiveness")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("psychological support")) {
    return "I value honest conversation and mutual support.";
  } else if (question.includes("private marital issue")) {
    return "I would encourage a private discussion to resolve the matter.";
  } else if (question.includes("prefer privacy")) {
    return "I appreciate my privacy and would seek a balance with my spouse's needs.";
  } else if (question.includes("boundaries")) {
    return "I believe clear boundaries are essential for both personal and shared space.";
  } else if (question.includes("joint family setup")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("in-laws expecting cultural practices")) {
    return "I would communicate my comfort levels clearly and respectfully.";
  } else if (question.includes("tradition you dislike")) {
    return "I would seek a respectful compromise.";
  } else if (question.includes("stated boundaries consistent")) {
    return "Yes, my boundaries match my core values.";
  } else if (question.includes("ideal financial arrangement")) {
    return "I prefer a balanced approach combining joint and separate responsibilities.";
  } else if (question.includes("financial transparency")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("both spouses work")) {
    return "I believe in open discussions for shared expenses and responsibilities.";
  } else if (question.includes("large purchase without consulting")) {
    return "I would address it directly to emphasize mutual decisions.";
  } else if (question.includes("unauthorized purchases")) {
    return "I would expect a transparent and consistent approach to finances.";
  } else if (question.includes("want children")) {
    return "I do want children and envision a supportive family environment.";
  } else if (question.includes("raise children with strong Islamic values")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("type of schooling")) {
    return "I lean towards Islamic schooling to keep our values intact.";
  } else if (question.includes("move abroad for better opportunities")) {
    return "I would discuss the pros and cons openly with my spouse.";
  } else if (question.includes("aspirations for children consistent")) {
    return "Yes, my aspirations for children align with my openness to change.";
  } else if (question.includes("polygamy")) {
    return question.includes("transparency") ? `${Math.floor(Math.random() * 10) + 1}` : "I consider polygamy under strict ethical conditions but prefer monogamy.";
  } else if (question.includes("views on divorce")) {
    return "I view divorce as a last resort after all reconciliation methods are attempted.";
  } else if (question.includes("proposes divorce")) {
    return "I would opt for counseling and mediation before any final decision.";
  } else if (question.includes("stance on polygamy align")) {
    return "Yes, my views on polygamy are consistent with my overall approach.";
  } else if (question.includes("mental health challenges")) {
    return "I believe in a compassionate approach, including professional help when necessary.";
  } else if (question.includes("supports you through mental or emotional struggles")) {
    return `${Math.floor(Math.random() * 10) + 1}`;
  } else if (question.includes("personal goals")) {
    return "I hope for mutual support in all aspects of life, including spiritual and professional growth.";
  } else if (question.includes("signs of depression or spiritual apathy")) {
    return "I would offer support and encourage professional assistance if needed.";
  } else if (question.includes("mutual support match the kind of help")) {
    return "Yes, I truly believe in being there during difficult times.";
  } else if (question.includes("top 5 priorities")) {
    return "Religious commitment (10), emotional intimacy (9), financial stability (8), family values (7), and mutual respect (9).";
  } else if (question.includes("feel differently about any issue")) {
    return "Yes, the process has given me new insights.";
  } else if (question.includes("possible contradictions")) {
    return "I believe that open communication can resolve any conflicting desires.";
  } else {
    return "Sample answer that reflects my view.";
  }
}

// Generate the 52 question objects with answers and timestamps
function generateQuestionsAnswers(baseTimestamp) {
  return questionsList.map((q, index) => ({
      question: q.question,
      answer: generateAnswer(q.question),
      createdAt: baseTimestamp + index
    }));
}

// Generate a profile object for a given index
function generateProfile(i) {
  const baseId = `profile_${String(i).padStart(4, '0')}`;
  const ts = 1700000000000 + i * 1000;
  const isMale = i % 2 === 0;
  const firstName = isMale ? getRandomElement(firstNamesMale) : getRandomElement(firstNamesFemale);
  return {
    id: baseId,
    firstName,
    lastName: getRandomElement(lastNames),
    email: `${baseId}@example.com`,
    phoneNumber: `+34 600 ${String(i).padStart(6, '0')}`,
    dob: { day: Math.floor(Math.random() * 28) + 1, month: Math.floor(Math.random() * 12) + 1, year: 1980 + Math.floor(Math.random() * 20) },
    address: { city: getRandomElement(cities) },
    wali: {
      firebaseUID: `wali_${String(i).padStart(4, '0')}`,
      relationship: getRandomElement(waliRelations)
    },
    questions_answers: generateQuestionsAnswers(ts)
  };
}

// Main profiles array
const profiles = [];

// To keep the final JSON file under approximately 16 MB, we reduce the number of primary profiles.
// Instead of generating 1000 profiles (which would be 2000 objects including the matches),
// here we generate 400 profiles (total 800 objects).
for (let i = 1; i <= 400; i++) {
  const profile = generateProfile(i);
  profiles.push(profile);

  // Generate corresponding 99% match profile
  const matchProfile = JSON.parse(JSON.stringify(profile)); // deep copy
  matchProfile.id = `match_${String(i).padStart(4, '0')}_for_${profile.id}`;
  if (matchProfile.questions_answers && matchProfile.questions_answers.length > 0) {
    matchProfile.questions_answers[0].answer += " (with a slightly different nuance)";
  }
  profiles.push(matchProfile);
}

// Write out the JSON array to a file named "profiles.json"
fs.writeFileSync("profiles.json", JSON.stringify(profiles, null, 2));
console.log("Generated profiles.json with", profiles.length, "profile objects (primary and match).");
