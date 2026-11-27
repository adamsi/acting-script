/**
 * The 12 steps of the Chubbuck technique: [Hebrew, English] title and description.
 * The Hebrew text is the summary published by Chubbuck Israel (chubbuckisrael.wixsite.com/12steps); the English is a translation of it.
 */

type Pair = [he: string, en: string];

export const STEPS: { title: Pair; text: Pair }[] = [
  {
    title: ['מטרת העל', 'Overall objective'],
    text: [
      'מה צריכה הדמות, שאתם מגלמים, יותר מכל? מה הצורך שמאחד את כל הבחירות שלה לאורך התסריט?',
      'What does the character you are playing need more than anything? What is the need that unites all of their choices throughout the script?',
    ],
  },
  {
    title: ['מטרת הסצינה', 'Scene objective'],
    text: [
      'מה צריכה הדמות במהלך סצינה שלמה. המטרה של הסצינה צריכה לתמוך במטרת העל של הדמות.',
      "What the character needs over the course of a whole scene. The scene objective should support the character's overall objective.",
    ],
  },
  {
    title: ['מכשולים', 'Obstacles'],
    text: [
      'הם המשוכות הגופניות, הריגשיות והמנטליות המקשות על הדמות להשיג את מטרת העל ואת מטרת הסצינה שלה. חשוב לזהות מספר מכשולים. חשוב לזהות קונפליקטים ודילמות.',
      'The physical, emotional and mental hurdles that make it hard for the character to achieve their overall objective and scene objective. It is important to identify several obstacles, and to identify conflicts and dilemmas.',
    ],
  },
  {
    title: ['תחליף', 'Substitution'],
    text: [
      'יצירת חיבור בין הפרטנר שלך לסצינה לבין דמות כלשהי מחייך האישיים בהתאם למטרת העל, למטרת הסצינה ולמכשולים.',
      'Connecting your scene partner to a person from your own life, in line with the overall objective, the scene objective and the obstacles.',
    ],
  },
  {
    title: ['אובייקטים פנימיים', 'Inner objects'],
    text: [
      'התמונות והרגשות שעולות במחשבתכם כשמדברים או שומעים על אדם, מקום, חפץ או אירוע.',
      'The images and feelings that come to mind when you talk or hear about a person, place, thing or event.',
    ],
  },
  {
    title: ['ביטים ופעולות Actions (ויוניטים)', 'Beats and actions (and units)'],
    text: [
      'ביט הוא מחשבה - כל פעם שיש שינוי במחשבה, הביט משתנה. הפעולות (על הפרטנר) הן מיני מטרות שמחוברות לכל ביט ותומכות בהשגת מטרת הסצינה ולכן גם תומכות בהשגת במטרת העל. כדי להשיג את מטרת הסצינה צריך להתגבר על המכשולים - פעולה היא התגברות על מיכשול. פעולה מושגת על ידי טקסט, doings ודיאלוג פנימי.',
      'A beat is a thought: every time the thought changes, the beat changes. The actions (on your partner) are mini-objectives attached to each beat; they support the scene objective and therefore the overall objective too. To achieve the scene objective you have to overcome the obstacles: an action is the overcoming of an obstacle. An action is carried out through text, doings and inner monologue.',
    ],
  },
  {
    title: ['רגע לפני', 'Moment before'],
    text: [
      'התהליך שהשחקן עושה עם עצמו לפני שאתה מתחילים את הסצינה והבמאי צועק "אקשן" ומספק לו את המקום ממנו אתם מתקדמים גם גופנית וגם ריגשית בהתאם למצב הפיזי, הריגשי והמכשולים של הדמות.',
      'The process the actor goes through alone before the scene starts and the director calls "action". It gives you the place to move forward from, both physically and emotionally, in line with the character\'s physical and emotional state and obstacles.',
    ],
  },
  {
    title: ['מקום וקיר רביעי', 'Place and fourth wall'],
    text: [
      'השימוש במקום ובקיר רביעי פירושו הענקת תכונות של מקום כלשהו מחייכם האמיתיים והשלכתו על סט הצילומים. הקיר הרביעי עוזר לתת תחושה של ביטחון ואינטימיות.',
      'Using place and fourth wall means taking the qualities of a place from your real life and projecting it onto the set. The fourth wall helps to give a sense of safety and intimacy.',
    ],
  },
  {
    title: ['מעשים Doings', 'Doings'],
    text: ['פעולות פיזיות וטיפול באביזרים שיוצר התנהגות של דמות.', 'Physical activity and the handling of props, which create the behaviour of a character.'],
  },
  {
    title: ['דיאלוג פנימי', 'Inner monologue'],
    text: ['הדיאלוג המתגלגל בתוך ראשכם שאינכם מבטאים בקול רם.', 'The dialogue running inside your head that you do not say out loud.'],
  },
  {
    title: ['נסיבות מקדימות', 'Previous circumstances'],
    text: [
      'ההיסטוריה של הדמות. מה בביוגרפיה שלה גורם לה להתנהג כמו שהיא מתנהגת. יצירת הזדהות בין הנסיבות המקדימות של הדמות לאלה שלכם.',
      "The character's history: what in their biography makes them behave the way they do. Finding where the character's previous circumstances meet your own.",
    ],
  },
  {
    title: ['לשחרר', 'Let it go'],
    text: [
      "להשתמש בכלים של צ׳בק שמשתמשים באינטלקט של השחקן בכדי ליצור התנהגות אנושית אך בזמן המשחק להפסיק להשתמש בראש! העבודה המקדימה אמורה לתת ביטחון ולאפשר לשחרר.",
      "Use Chubbuck's tools, which draw on the actor's intellect, to create human behaviour — but while acting, stop using your head! The preparation is there to give you confidence and let you let go.",
    ],
  },
];
