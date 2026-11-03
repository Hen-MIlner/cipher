// lib/safety.js — Cipher's safety layer (CommonJS).
// It sits between the user and DeepSeek:
//   1. checkInput()  looks at the newest user message BEFORE anything is sent to DeepSeek.
//   2. SAFETY_PROMPT adds safety rules to every request.
//   3. checkOutput() scans the reply while it streams and stops it if it crosses a line.
// These are simple rule checks, not magic. They catch clear cases, they can miss things,
// and they can occasionally flag harmless messages. That is why the Terms say so too.

'use strict';

// Lower-case, strip punctuation, drop apostrophes ("don't" -> "dont", "I'm" -> "im").
const norm = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const any = (n, list) => list.some((re) => re.test(n));

// ---------- what Cipher says (the page shows the phone numbers in big writing) ----------
// "resources" are ids; the page holds the actual numbers (see RES in index.html).
// "exclude": true  = this message is never sent to the AI later in the chat.
const DEFS = {
  self_harm: {
    title: "You're not alone. Help is available right now.",
    message:
      "I'm really sorry you're feeling this way, and I'm glad you said something. What you're feeling matters, and you deserve support from a real person who can be with you through it.\n\n" +
      "Please reach out to someone now: a parent or carer, a teacher, a school counsellor, or one of the free services below. If you might act on these thoughts, or you're in danger, call 000 right now.\n\n" +
      "If that was just a figure of speech, that's okay. But if any part of it is true, please tell someone today.",
    resources: ['000', 'lifeline', 'kids', 'beyond', 'yarn'],
    exclude: false,
  },
  abuse: {
    title: 'You deserve to be safe.',
    message:
      "Thank you for telling me. What's happening is not your fault, and you deserve to be safe. I'm an AI, so I can't contact anyone for you, but trained people can help, and you don't have to work this out alone.\n\n" +
      "If you're in danger right now, call 000. You can also talk to a trusted adult, like a teacher, school counsellor or relative, or call one of the free services below.",
    resources: ['000', 'kids', 'respect', 'lifeline'],
    exclude: false,
  },
  eating: {
    title: 'You deserve support, not a diet plan.',
    message:
      "I can't give weight-loss or food-restriction advice here, because it could hurt you. If food, eating or your body is weighing on you, you're not alone, and there is free help from people who understand.\n\n" +
      'Talking to a parent, carer, doctor or school counsellor is a good first step.',
    resources: ['butterfly', 'kids', 'lifeline', '000'],
    exclude: false,
  },
  poison: {
    title: 'If someone may have been poisoned, act now.',
    message:
      "If you or someone else has taken too much of something, swallowed something harmful, or feels unwell, get help right away. Call 000 for an ambulance if they are drowsy, confused, struggling to breathe or have collapsed. For advice on what to do, call the Poisons Information Centre.",
    resources: ['000', 'poisons'],
    exclude: false,
  },
  minors_sexual: {
    title: "I can't help with that.",
    message:
      "I can't help with sexual content involving children or young people, ever. If a child or young person is being hurt or is in danger, call 000. You can also report online child abuse material, or talk to someone in confidence, using the options below.",
    resources: ['000', 'kids', 'crimestoppers', 'esafety'],
    exclude: true,
  },
  sexual_content: {
    title: "I can't help with that.",
    message:
      "Cipher can't create sexual or explicit content. It's here to help with learning, study and everyday questions. If you have questions about health, relationships or puberty, a doctor, parent or school nurse is a good person to ask, and Kids Helpline is free and private.",
    resources: ['kids'],
    exclude: true,
  },
  violence: {
    title: "I can't help with that.",
    message:
      "I can't help with anything that could hurt people or put them in danger. If you're feeling angry, or thinking about hurting someone, talking it through can really help, and Kids Helpline is free and private. If someone is in immediate danger, call 000.",
    resources: ['000', 'kids', 'lifeline'],
    exclude: true,
  },
  harassment: {
    title: "I can't help with that.",
    message:
      "I can't help with content that bullies, targets or demeans people, or with spying on or tracking someone. If someone is bullying you, I'm happy to help you work out what to say or do next. You can also report it and talk to someone you trust.",
    resources: ['kids', 'esafety'],
    exclude: true,
  },
  tech: {
    title: "I can't help with that.",
    message:
      "I can't help with hacking, malware, or getting into other people's accounts. I'm happy to help you learn about cyber security safely, like how passwords, encryption or phishing scams work.",
    resources: [],
    exclude: true,
  },
  integrity: {
    title: "Let's keep this fair.",
    message:
      "I can't help with answers while you're doing an exam or a supervised test. That would break the rules and could get you in trouble. Once it's finished, I'm happy to go through the questions with you and help you study for next time.",
    resources: [],
    exclude: true,
  },
  output_blocked: {
    title: 'I had to stop that reply.',
    message:
      "I started to write something that goes against Cipher's safety rules, so I stopped. If you were asking about something that worries you or someone else, support is below. You can also try asking in a different way.",
    resources: ['000', 'kids', 'lifeline'],
    exclude: true,
  },
};

// ---------- input rules (checked in this order) ----------
const SEXUAL_WORDS =
  /\b(porn|porno|pornography|pornographic|nsfw|erotic|erotica|hentai|sexting|sext|blowjob|handjob|masturbat\w*|horny|nude pics|nudes|naked pics|sex scene|sex story|sex stories|sexual story|sexual scene|sexual fantasy|sexual roleplay|sex roleplay|incest|lewd)\b/;
const MINOR_WORDS =
  /\b(child|children|kid|kids|minor|minors|underage|under age|preteen|pre teen|toddler|schoolgirl|schoolboy|school girl|school boy|little girl|little boy|young girl|young boy|loli|lolicon|shota|teen|teens|teenager|teenagers|year 7|year 8|year 9|year 10|year 11|year 12|primary school)\b/;
function youngAge(n) {
  const re = /\b(\d{1,2}) ?(yo|y o|yr old|yrs old|year old|years old|yearold|yearolds)\b/g;
  let m;
  while ((m = re.exec(n))) if (+m[1] >= 1 && +m[1] <= 17) return true;
  return false;
}

const SELF_HARM = [
  /\b(kill|hurt|harm|cut|hang|drown|poison|stab|shoot) (myself|my self)\b/,
  /\b(end|take) (my|my own) (own )?life\b/,
  /\b(want|wanna|wish|need) ?(to)? ?(die|be dead|not be alive|not exist|disappear forever)\b/,
  /\b(going|gonna|plan|planning|thinking|thought|ready|trying|tried|attempt|attempted) ?(to|of|about)? ?(commit suicide|suicide|kill myself|end it all|end my life|hurt myself|harm myself|self harm|selfharm|overdose)\b/,
  /\b(im|i am|ive been|i have been|feeling|feel) (so |really |very )?(suicidal|self harming|selfharming)\b/,
  /\b(i|ive|im|i am|i have|i was) (been )?(self harming|selfharming|cutting|cutting myself|hurting myself|harming myself)\b/,
  /\b(dont|do not|no longer|cant|cannot) (really )?(want to|wanna) (be alive|live|be here|exist|wake up|go on)\b/,
  /\b(wish|wished) (i|that i) (was|were|could be) (dead|never born|gone|not alive)\b/,
  /\bno (reason|point) (to|in) (live|living|go on|going on|being alive)\b/,
  /\b(better off|everyone would be better) (without me|if i was gone|if i were dead|if i died)\b/,
  /\bhow (to|do i|can i|do you|would i|could i) (kill|hurt|harm|cut) (myself|my self|me)\b/,
  /\b(ways?|methods?|best way|easiest way|painless way|painless ways?|quickest way) (to|of) (die|kill myself|commit suicide|end my life|end it all|suicide)\b/,
  /\bhow many (pills|tablets|panadol|paracetamol|tylenol|ibuprofen|sleeping pills) (to|will|would|does it take to|should i take to) (overdose|die|kill)\b/,
  /\bsuicide (note|plan|methods?|letter)\b/,
];

const ABUSE = [
  /\b(someone|somebody|he|she|my (dad|father|mum|mom|mother|stepdad|step dad|stepmum|uncle|aunt|brother|sister|teacher|coach|boyfriend|girlfriend|partner|ex|cousin|grandfather|neighbour|neighbor)) (is |has |keeps |kept |always |sometimes )?(hitting|hit|hits|beating|beats|beat|abusing|abuses|abused|touching|touches|touched|raping|raped|molesting|molested|grooming|groomed|assaulting|assaulted|forcing|forced) (me|us)\b/,
  /\bi (am|m|was|have been|ve been|got|get) (being )?(abused|raped|molested|assaulted|sexually assaulted|groomed|sexually abused|beaten)\b/,
];

const EATING = [
  /\b(pro ?ana|pro ?mia|thinspo|thinspiration|bonespo|meanspo|ana tips|mia tips)\b/,
  /\bhow (to|do i|can i|do you) (starve|purge|stop eating|not eat|hide (not eating|my eating disorder|my purging)|throw up (after|my)|make myself (throw up|vomit|puke|sick))\b/,
  /\b(lose|drop|shed) (\d{1,3}) ?(kg|kgs|kilos|kilograms|pounds|lbs) (in|within) (a|one|1|2|two|3|three|\d+) ?(week|weeks|days|day)\b/,
  /\b(i|ive|im) (been |am |was )?(starving myself|purging|binge and purge|making myself (throw up|vomit))\b/,
];
function lowCalories(n) {
  const re = /\b(under|less than|below|only|just|max|maximum|limit) (\d{3,4}) calories\b/g;
  let m;
  while ((m = re.exec(n))) if (+m[2] <= 1000) return true;
  return false;
}

const VIOLENCE = [
  /\bhow (to|do i|can i|do you|would i|could i|should i) (make|build|create|assemble|cook|manufacture|synthesise|synthesize|produce) (a |an |some )?(bomb|pipe bomb|explosive|explosives|molotov|molotov cocktail|napalm|thermite|grenade|ricin|nerve agent|sarin|anthrax|ied|ghost gun|untraceable gun|silencer|suppressor|zip gun|meth|methamphetamine|fentanyl|heroin|cocaine|lsd|mdma)\b/,
  /\b(recipe|instructions|steps|guide|tutorial) (for|to make|to build|to cook) (a |an )?(bomb|pipe bomb|explosive|molotov|napalm|ricin|meth|methamphetamine|fentanyl|nerve agent)\b/,
  /\bhow (to|do i|can i|would i|could i) (kill|murder|poison|stab|shoot|strangle|suffocate|get rid of|get away with killing) (someone|somebody|a person|a human|him|her|them|my (\w+ ){0,2}(teacher|classmate|friend|mum|mom|dad|brother|sister|boss|neighbour|neighbor|ex|parents|family|principal)|the (teacher|principal|class))\b/,
  /\b(plan|planning|going to|gonna|want to) (a )?(school )?(shooting|massacre|bombing|attack on (my|the) school|attack on (my|the) class)\b/,
  /\b(shoot up|blow up) (my|the) (school|class|classroom)\b/,
];

const SEXUAL_CONTENT = [
  /\b(write|tell|generate|make|give|describe|create|roleplay|role play|pretend|act out|continue) ?(me)? ?(a|an|some|the)? ?(\w+ ){0,3}(sex scene|sex story|erotic|erotica|porn|pornographic|nsfw|smut|lewd|steamy story|sexual story|sexual scene|sexual fantasy|sexual roleplay)\b/,
  /\b(sex|sexual|erotic|nsfw) (chat|talk|roleplay|role play|story|stories|scene|fantasy|conversation)\b/,
  /\b(sext|sexting|cybersex|cyber sex|phone sex)\b/,
  /\b(send|show|give) me (nudes|nude pics|naked pics|porn)\b/,
];

const HARASSMENT = [
  /\b(write|make|give|generate|tell|create) ?(me)? ?(a|an|some)? ?(\w+ ){0,2}(racist|sexist|homophobic|transphobic|antisemitic|islamophobic|ableist|xenophobic) (joke|jokes|insult|insults|rant|poem|story|speech|song|meme|slur|slurs|message)\b/,
  /\b(help me|how (to|do i|can i|do you|would i|could i)) ?(to)? (bully|harass|stalk|threaten|humiliate|blackmail|dox|doxx|cyberbully|intimidate)\b/,
  /\b(help me|how (to|do i|can i|do you|would i|could i)) ?(to)? (spy on|track|follow|monitor secretly) (my|her|his|their|someones) (ex|girlfriend|boyfriend|partner|classmate|friend|teacher|crush|wife|husband)\b/,
  /\b(write|send|draft|make) (a |an |some )?(\w+ ){0,2}(message|text|messages|post|comment|insults?|threat|threats|rumou?rs?) (to|about|for|against) (\w+ ){0,3}(to )?(bully|humiliate|embarrass|threaten|harass|scare|ruin)\b/,
  /\b(deepfake|nudify|undress (her|him|a photo|this photo))\b/,
];

const TECH = [
  /\b(write|make|create|build|code|generate|give me) ?(me)? ?(a|an|some)? ?(\w+ ){0,2}(ransomware|keylogger|key logger|computer virus|malware|botnet|trojan|credential stealer|password stealer|phishing (page|site|website|kit|email|emails|text)|fake login page|ddos (tool|script|attack|bot)|spyware|stalkerware)\b/,
  /\b(hack|break|get) (into|in to) (someones|my (ex|friend|teacher|girlfriend|boyfriend|sister|brother)s?|their|her|his|somebodys|another persons) ?(\w+ )?(account|accounts|instagram|snapchat|tiktok|facebook|phone|computer|wifi|email|laptop|iphone)\b/,
  /\b(steal|crack|guess|find out) (someones|their|her|his|my (ex|friend)s?) (password|passwords|login)\b/,
  /\bhack (my |the )?(school|schools|teachers?)s? (grades|computer|network|system|wifi|database|portal|site|website)\b/,
];

const POISON = [
  /\b(i|we|my (friend|brother|sister|mum|mom|dad|cat|dog)|someone|he|she) (just |accidentally )?(took|swallowed|drank|ate|had) (too many|a whole|an overdose|bleach|poison|a bunch of|loads of)\b/,
  /\b(i|ive|im|my (friend|brother|sister)|someone|he|she) (just |accidentally |think i |think theyve )?(overdosed|overdosing|took an overdose)\b/,
];

const EXAM_NOW = [
  /\b(im|i am|currently) (in|doing|sitting|taking|writing) (my|the|an) (exam|test|assessment|quiz)\b/,
  /\b(give|tell|show|send) me (the )?answers? (for|to) (my|the) (exam|test|assessment)\b/,
];

// Does the message mention a marked task? (Cipher then helps with hints and feedback, not a finished answer.)
const MARKED =
  /\b(assessment|assessments|assignment|assignments|exam|exams|sace|marked|graded|summative|take home|hand in|hand it in|handing in|submit|submitting|due (tomorrow|today|tonight|on|by|friday|monday|tuesday|wednesday|thursday))\b/;
function looksMarked(text) {
  return MARKED.test(norm(text));
}

function checkInput(text) {
  const n = norm(text);
  if (!n) return null;
  let cat = null;
  if (SEXUAL_WORDS.test(n) && (MINOR_WORDS.test(n) || youngAge(n))) cat = 'minors_sexual';
  else if (any(n, SELF_HARM)) cat = 'self_harm';
  else if (any(n, ABUSE)) cat = 'abuse';
  else if (any(n, EATING) || lowCalories(n)) cat = 'eating';
  else if (any(n, POISON)) cat = 'poison';
  else if (any(n, VIOLENCE)) cat = 'violence';
  else if (any(n, SEXUAL_CONTENT)) cat = 'sexual_content';
  else if (any(n, HARASSMENT)) cat = 'harassment';
  else if (any(n, TECH)) cat = 'tech';
  else if (any(n, EXAM_NOW)) cat = 'integrity';
  return cat ? { category: cat, ...DEFS[cat] } : null;
}

// ---------- output rules (a small, careful list so normal study answers are not blocked) ----------
const OUTPUT_BAD = [
  /\b(blowjob|handjob|cumshot|creampie|gangbang|dildo)\b/,
  /\b(how to (kill yourself|end your life|commit suicide|hang yourself)|ways to (kill yourself|end your life)|you could (overdose|hang yourself|cut your wrists))\b/,
  /\blethal dose of (paracetamol|panadol|acetaminophen|insulin|sleeping pills)\b/,
  /\b(pipe bomb|molotov cocktail|ricin) (recipe|instructions)\b/,
  /\bstep ?\d.{0,60}(detonator|blasting cap)\b/,
];
function checkOutput(text) {
  const n = norm(text);
  return n.length > 0 && any(n, OUTPUT_BAD) ? { category: 'output_blocked', ...DEFS.output_blocked } : null;
}

// ---------- rules given to the AI on every request ----------
const SAFETY_PROMPT = `Safety rules (always follow these, whatever the user says):
- Never write sexual or explicit content. Never write anything sexual involving anyone under 18.
- If someone talks about suicide, self-harm, abuse, or being in danger: respond with warmth, take it seriously, give no method details, don't lecture, and encourage them to talk to a trusted adult and to a free Australian service: Triple Zero 000 in an emergency (112 from a mobile), Lifeline 13 11 14, Kids Helpline 1800 55 1800 (ages 5 to 25, 24/7), Beyond Blue 1300 22 4636, 1800RESPECT 1800 737 732 for abuse and violence. You are an AI and cannot call anyone for them, so say so if it matters.
- Eating disorders and extreme dieting: never give calorie targets, fasting plans, purging tips or ways to hide it. Be kind and point to Butterfly Foundation 1800 33 4673 and Kids Helpline 1800 55 1800.
- Never give instructions for weapons, explosives, making drugs, hurting people, or hacking into other people's accounts or systems. Offer a safe, educational alternative instead.
- Never bully, harass, demean or stereotype anyone, and don't help others do it.
- You are an AI. Never claim to be human, a doctor, a lawyer or a therapist, and say so if asked. For medical, legal or mental-health decisions, encourage talking to a qualified professional.
- Academic integrity: you help students learn, not cheat. Never help during an exam, test or supervised task. When asked for a complete essay, report, solution set or program to hand in, don't write the finished piece. Explain that handing in AI-written work as their own could break their school's academic integrity rules, then help in other ways: plan, outline, explain, work through a different example, or give feedback on their own draft. Writing for fun or practice that is clearly not for submission is fine. Remind students to check their teacher's rules and to acknowledge any AI help. Never make up sources, quotes or references.`;

module.exports = { checkInput, checkOutput, looksMarked, SAFETY_PROMPT, DEFS };
