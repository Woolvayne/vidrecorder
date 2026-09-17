import type { Language, ParsedPrompt, ResearchBrief, ScriptSection } from "@/lib/types";
import { hashSeed, mulberry32, splitSentences, uid, wordCount } from "@/lib/utils";

/**
 * Free local script engine. Deterministic-but-varied natural language
 * generation driven by research facts. Supports DE / EN / ES / FR.
 * No external AI API required — the "Fallback" tier of the AI provider chain.
 */

interface PhraseBank {
  hooks: ((topic: string, fact?: string) => string)[];
  intro: (topic: string, mins: string) => string;
  chapterTitles: ((i: number) => string)[];
  transitions: string[];
  factLead: string[];
  conclusion: (topic: string) => string;
  cta: string;
  listItemLead: string[];
  minutes: (m: number) => string;
}

const BANKS: Record<Language, PhraseBank> = {
  en: {
    hooks: [
      (t, f) => `What if everything you thought you knew about ${t} was only half the story?${f ? ` ${f}` : ""} And that is just the beginning.`,
      (t, f) => `${f ? f + " " : ""}Sounds unbelievable? It is absolutely real. Let's talk about ${t}.`,
      (t) => `Stop scrolling. The next few minutes will change the way you see ${t} — forever.`,
      (t) => `There is a side of ${t} that almost nobody talks about. Today, we are going to change that.`,
      (t) => `${t}. One topic. A thousand questions. And in the next few minutes: the answers that actually matter.`,
    ],
    intro: (t, m) => `Welcome back to the channel. In this video, we dive deep into ${t} — researched, condensed, and packed into ${m} of pure insight. Let's get into it.`,
    chapterTitles: [
      () => "Where it all began",
      () => "The turning point",
      () => "What most people miss",
      () => "The hidden details",
      () => "Why it still matters today",
      () => "The bigger picture",
      () => "The untold chapter",
      () => "What the facts reveal",
    ],
    transitions: [
      "But that was only the start.",
      "And then it gets really interesting.",
      "Here is where the story takes a turn.",
      "Now, look at what happened next.",
      "But wait — there is more.",
      "And that is not even the most surprising part.",
      "So what does that actually mean?",
    ],
    factLead: [
      "Get this:", "Here is the fascinating part:", "Consider this:",
      "The records show something remarkable.", "It turns out that…", "Remarkably,",
    ],
    listItemLead: ["Coming in first:", "Next up:", "Right behind that:", "High on the list:", "You cannot skip this one:"],
    conclusion: (t) => `So, what is the real takeaway? ${t} is far more than a footnote — it is a story that still shapes our world today. The more you look, the more there is to discover.`,
    cta: "If this video taught you something new, leave a like, subscribe, and hit the bell — it genuinely helps the channel. Drop your thoughts in the comments: what should we cover next? See you in the next one.",
    minutes: (m) => (m >= 1 ? `${m} minutes` : "under a minute"),
  },
  de: {
    hooks: [
      (t, f) => `Was, wenn alles, was du über ${t} zu wissen glaubtest, nur die halbe Wahrheit ist?${f ? ` ${f}` : ""} Und das ist erst der Anfang.`,
      (t, f) => `${f ? f + " " : ""}Klingt unglaublich? Ist aber absolut real. Lass uns über ${t} sprechen.`,
      (t) => `Kurz stoppen: Die nächsten Minuten verändern, wie du ${t} siehst — für immer.`,
      (t) => `Es gibt eine Seite von ${t}, über die kaum jemand spricht. Heute ändern wir das.`,
      (t) => `${t}. Ein Thema. Tausend Fragen. Und in den nächsten Minuten: die Antworten, die wirklich zählen.`,
    ],
    intro: (t, m) => `Willkommen zurück auf dem Kanal. In diesem Video tauchen wir tief ein in ${t} — recherchiert, verdichtet und aufbereitet in ${m} voller Erkenntnisse. Legen wir los.`,
    chapterTitles: [
      () => "Wo alles begann",
      () => "Der Wendepunkt",
      () => "Was die meisten übersehen",
      () => "Die verborgenen Details",
      () => "Warum es bis heute zählt",
      () => "Das große Ganze",
      () => "Das unerzählte Kapitel",
      () => "Was die Fakten zeigen",
    ],
    transitions: [
      "Doch das war erst der Anfang.",
      "Und jetzt wird es richtig spannend.",
      "An dieser Stelle nimmt die Geschichte eine Wendung.",
      "Schauen wir, was als Nächstes geschah.",
      "Aber warte — da gibt es noch mehr.",
      "Und das ist noch nicht einmal das Überraschendste.",
      "Was bedeutet das eigentlich?",
    ],
    factLead: [
      "Pass auf:", "Der spannende Teil:", "Bedenke Folgendes:",
      "Die Aufzeichnungen zeigen etwas Bemerkenswertes.", "Es stellt sich heraus:", "Bemerkenswerterweise:",
    ],
    listItemLead: ["Auf dem ersten Platz:", "Weiter geht's mit:", "Direkt dahinter:", "Ganz oben auf der Liste:", "Den darf man nicht überspringen:"],
    conclusion: (t) => `Was ist also die echte Erkenntnis? ${t} ist weit mehr als eine Randnotiz — es ist eine Geschichte, die unsere Welt bis heute prägt. Je genauer man hinschaut, desto mehr gibt es zu entdecken.`,
    cta: "Wenn du etwas Neues gelernt hast, lass ein Like da, abonniere den Kanal und aktiviere die Glocke — das hilft wirklich. Schreib in die Kommentare, welches Thema als Nächstes kommen soll. Bis zum nächsten Video.",
    minutes: (m) => (m >= 1 ? `${m} Minuten` : "unter einer Minute"),
  },
  es: {
    hooks: [
      (t, f) => `¿Y si todo lo que creías saber sobre ${t} fuera solo la mitad de la historia?${f ? ` ${f}` : ""} Y esto es solo el principio.`,
      (t, f) => `${f ? f + " " : ""}¿Suena increíble? Es completamente real. Hablemos de ${t}.`,
      (t) => `Un momento: los próximos minutos cambiarán tu forma de ver ${t} — para siempre.`,
      (t) => `Hay un lado de ${t} del que casi nadie habla. Hoy vamos a cambiarlo.`,
      (t) => `${t}. Un tema. Mil preguntas. Y en los próximos minutos: las respuestas que de verdad importan.`,
    ],
    intro: (t, m) => `Bienvenidos de nuevo al canal. En este video nos sumergimos en ${t} — investigado, condensado y preparado en ${m} de puro conocimiento. Empecemos.`,
    chapterTitles: [
      () => "Donde todo comenzó", () => "El punto de inflexión", () => "Lo que casi nadie ve",
      () => "Los detalles ocultos", () => "Por qué sigue importando", () => "El panorama completo",
      () => "El capítulo no contado", () => "Lo que revelan los datos",
    ],
    transitions: [
      "Pero eso fue solo el comienzo.", "Y ahora se pone realmente interesante.",
      "Aquí la historia da un giro.", "Mira lo que pasó después.",
      "Pero espera — hay más.", "Y eso ni siquiera es lo más sorprendente.", "¿Qué significa esto en realidad?",
    ],
    factLead: ["Mira esto:", "La parte fascinante:", "Considera esto:", "Los registros muestran algo notable.", "Resulta que…", "Curiosamente,"],
    listItemLead: ["En primer lugar:", "A continuación:", "Justo detrás:", "En lo alto de la lista:", "Este no te lo puedes saltar:"],
    conclusion: (t) => `Entonces, ¿cuál es la verdadera lección? ${t} es mucho más que una nota al pie: es una historia que aún da forma a nuestro mundo. Cuanto más miras, más hay por descubrir.`,
    cta: "Si aprendiste algo nuevo, deja un me gusta, suscríbete y activa la campana — ayuda muchísimo. Cuéntanos en los comentarios qué tema quieres ver después. Nos vemos en el próximo video.",
    minutes: (m) => (m >= 1 ? `${m} minutos` : "menos de un minuto"),
  },
  fr: {
    hooks: [
      (t, f) => `Et si tout ce que vous croyiez savoir sur ${t} n'était que la moitié de l'histoire ?${f ? ` ${f}` : ""} Et ce n'est que le début.`,
      (t, f) => `${f ? f + " " : ""}Incroyable, non ? C'est pourtant bien réel. Parlons de ${t}.`,
      (t) => `Arrêtez de défiler : les prochaines minutes vont changer votre regard sur ${t} — pour toujours.`,
      (t) => `Il y a un côté de ${t} dont presque personne ne parle. Aujourd'hui, on change ça.`,
      (t) => `${t}. Un sujet. Mille questions. Et dans les prochaines minutes : les réponses qui comptent vraiment.`,
    ],
    intro: (t, m) => `Bonjour et bienvenue sur la chaîne. Dans cette vidéo, nous plongeons au cœur de ${t} — recherché, condensé et présenté en ${m} de pur savoir. C'est parti.`,
    chapterTitles: [
      () => "Là où tout a commencé", () => "Le tournant", () => "Ce que presque tout le monde rate",
      () => "Les détails cachés", () => "Pourquoi c'est encore crucial", () => "Vue d'ensemble",
      () => "Le chapitre jamais raconté", () => "Ce que révèlent les faits",
    ],
    transitions: [
      "Mais ce n'était que le début.", "Et c'est là que ça devient vraiment intéressant.",
      "C'est ici que l'histoire bascule.", "Regardez ce qui s'est passé ensuite.",
      "Mais attendez — il y a plus.", "Et ce n'est même pas le plus surprenant.", "Qu'est-ce que cela signifie vraiment ?",
    ],
    factLead: ["Écoutez bien :", "Voici le plus fascinant :", "Considérez ceci :", "Les archives révèlent quelque chose de remarquable.", "Il s'avère que…", "Fait remarquable :"],
    listItemLead: ["En première position :", "Ensuite :", "Juste derrière :", "En haut du classement :", "Impossible de passer à côté :"],
    conclusion: (t) => `Alors, que faut-il retenir ? ${t} est bien plus qu'une note de bas de page — c'est une histoire qui façonne encore notre monde. Plus on regarde, plus on découvre.`,
    cta: "Si vous avez appris quelque chose, laissez un like, abonnez-vous et activez la cloche — ça aide vraiment la chaîne. Dites-nous en commentaire quel sujet vous voulez voir ensuite. À très vite.",
    minutes: (m) => (m >= 1 ? `${m} minutes` : "moins d'une minute"),
  },
};

const GENERIC_FACTS: Record<Language, (topic: string) => string[]> = {
  en: (t) => [
    `${t} is a topic that continues to fascinate researchers and enthusiasts alike.`,
    `Over the years, the story of ${t} has been shaped by remarkable events and people.`,
    `Understanding ${t} means looking at both the headlines and the details in between.`,
    `Every era added a new chapter to the story of ${t}.`,
    `The impact of ${t} reaches further than most people realize.`,
  ],
  de: (t) => [
    `${t} ist ein Thema, das Forscher und Enthusiasten gleichermaßen fasziniert.`,
    `Im Laufe der Jahre wurde die Geschichte von ${t} durch bemerkenswerte Ereignisse und Menschen geprägt.`,
    `Wer ${t} verstehen will, muss sowohl die Schlagzeilen als auch die Details dazwischen betrachten.`,
    `Jede Epoche fügte der Geschichte von ${t} ein neues Kapitel hinzu.`,
    `Der Einfluss von ${t} reicht weiter, als die meisten vermuten.`,
  ],
  es: (t) => [
    `${t} es un tema que sigue fascinando a investigadores y entusiastas por igual.`,
    `Con los años, la historia de ${t} ha sido moldeada por eventos y personas extraordinarias.`,
    `Entender ${t} implica mirar tanto los titulares como los detalles intermedios.`,
    `Cada época añadió un nuevo capítulo a la historia de ${t}.`,
    `El impacto de ${t} llega más lejos de lo que la mayoría cree.`,
  ],
  fr: (t) => [
    `${t} est un sujet qui continue de fasciner chercheurs et passionnés.`,
    `Au fil des ans, l'histoire de ${t} a été façonnée par des événements et des personnes remarquables.`,
    `Comprendre ${t}, c'est regarder à la fois les gros titres et les détails.`,
    `Chaque époque a ajouté un nouveau chapitre à l'histoire de ${t}.`,
    `L'impact de ${t} va bien plus loin que la plupart ne l'imaginent.`,
  ],
};

function shortenFact(fact: string, maxWords = 34): string {
  const words = fact.split(/\s+/);
  if (words.length <= maxWords) return fact;
  return words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "") + ".";
}

export function generateScript(parsed: ParsedPrompt, research: ResearchBrief | null): ScriptSection[] {
  const bank = BANKS[parsed.language] ?? BANKS.en;
  const rng = mulberry32(hashSeed(parsed.topic + parsed.format));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const topic = parsed.topic;

  const researchFacts = research?.facts ?? [];
  const safeFacts = researchFacts.length
    ? researchFacts
    : GENERIC_FACTS[parsed.language](topic);

  // fill towards target length
  const factPool: string[] = [];
  while (factPool.length < 90) {
    for (const f of safeFacts) factPool.push(shortenFact(f));
    if (factPool.length >= 90) break;
  }

  const sections: ScriptSection[] = [];
  const hookFn = pick(bank.hooks);
  const hookFact = researchFacts[0] ? shortenFact(researchFacts[Math.floor(rng() * Math.min(3, researchFacts.length))]) : undefined;
  const mins = Math.max(1, Math.round(parsed.durationSec / 60));

  sections.push({ id: uid("sec"), type: "hook", title: "HOOK", text: hookFn(topic, hookFact) });
  sections.push({ id: uid("sec"), type: "intro", title: "INTRODUCTION", text: bank.intro(topic, bank.minutes(mins)) });

  const usedWords = () => sections.reduce((a, s) => a + wordCount(s.text), 0);
  const chapterCount =
    parsed.format === "shorts" ? 2 :
    parsed.format === "top10" ? 10 :
    Math.max(3, Math.min(9, Math.round(parsed.durationSec / 75)));

  let fi = Math.floor(rng() * 3); // fact index, slight offset for variety
  for (let c = 0; c < chapterCount && usedWords() < parsed.wordsTarget; c++) {
    const titleFn = bank.chapterTitles[c % bank.chapterTitles.length];
    const title =
      parsed.format === "top10"
        ? `${pick(["Number", "No.", "Place"])} ${chapterCount - c}`
        : titleFn(c);
    const sentences: string[] = [];
    const chapterTargetWords = Math.max(28, Math.round((parsed.wordsTarget - 120) / chapterCount));
    sentences.push(parsed.format === "top10" ? pick(bank.listItemLead) : pick(bank.transitions));
    while (wordCount(sentences.join(" ")) < chapterTargetWords && fi < factPool.length - 1) {
      const lead = rng() < 0.35 ? pick(bank.factLead) : "";
      const f1 = factPool[fi++ % factPool.length];
      sentences.push(lead ? `${lead} ${f1}` : f1);
      if (rng() < 0.3) sentences.push(pick(bank.transitions));
      if (rng() < 0.25 && fi < factPool.length) sentences.push(shortenFact(factPool[fi++ % factPool.length], 22));
    }
    sections.push({ id: uid("sec"), type: "chapter", title: title.toUpperCase(), text: sentences.join(" ") });
  }

  sections.push({ id: uid("sec"), type: "conclusion", title: "CONCLUSION", text: bank.conclusion(topic) });
  sections.push({ id: uid("sec"), type: "cta", title: "CALL TO ACTION", text: bank.cta });

  return sections;
}

export const scriptToText = (sections: ScriptSection[]) =>
  sections.map((s) => `${s.title}\n${s.text}`).join("\n\n");

export const textToSections = (text: string, lang: Language): ScriptSection[] => {
  void lang;
  const blocks = text.split(/\n{2,}|\r?\n(?=[A-ZÄÖÜ]{3,}\s*$)/m).map((b) => b.trim()).filter(Boolean);
  const types: ScriptSection["type"][] = ["hook", "intro", "chapter", "conclusion", "cta"];
  if (blocks.length < 2) {
    // single block: split by sentences into pseudo-chapters
    const sents = splitSentences(text);
    const chunk = Math.max(2, Math.ceil(sents.length / 5));
    const out: ScriptSection[] = [];
    for (let i = 0; i < sents.length; i += chunk) {
      const idx = out.length;
      out.push({
        id: uid("sec"),
        type: types[Math.min(idx, 3)] ?? "chapter",
        title: idx === 0 ? "HOOK" : idx === 1 ? "INTRODUCTION" : `SECTION ${String(idx).padStart(2, "0")}`,
        text: sents.slice(i, i + chunk).join(" "),
      });
    }
    return out;
  }
  return blocks.map((b, i) => {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const hasTitle = lines.length > 1 && lines[0] === lines[0].toUpperCase() && lines[0].length < 60;
    const title = hasTitle ? lines[0] : i === 0 ? "HOOK" : i === 1 ? "INTRODUCTION" : `SECTION ${String(i).padStart(2, "0")}`;
    const textBody = hasTitle ? lines.slice(1).join(" ") : lines.join(" ");
    const lower = title.toLowerCase();
    const type: ScriptSection["type"] =
      lower.includes("hook") ? "hook" :
      lower.includes("intro") ? "intro" :
      lower.includes("conclusion") || lower.includes("fazit") ? "conclusion" :
      lower.includes("cta") || lower.includes("call to action") ? "cta" :
      types.includes(lower as ScriptSection["type"]) ? (lower as ScriptSection["type"]) :
      i === 0 ? "hook" : i === blocks.length - 1 ? "cta" : "chapter";
    return { id: uid("sec"), type, title, text: textBody };
  });
};
