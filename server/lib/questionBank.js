// server/lib/questionBank.js
//
// Offline fallback questions. Used when there's no GEMINI_API_KEY, Gemini is
// rate-limited, or it returns too few / duplicate questions. Also what the
// bot bases are quizzed on. Format per entry:
//   [topic, question, [4 options], correctIndex, explanation]

const B = (topics) => topics;

export const BANK = [
  {
    key: "mathematics",
    match: ["math", "algebra", "geometry", "calculus", "trigonometry", "statistics"],
    topics: ["Algebra", "Geometry", "Trigonometry", "Statistics"],
    q: B([
      ["Algebra", "Solve for x: 3x + 7 = 22.", ["x = 3", "x = 5", "x = 7", "x = 15"], 1, "Subtract 7 to get 3x = 15, then divide by 3."],
      ["Algebra", "What is the value of (a + b)² expanded?", ["a² + b²", "a² + 2ab + b²", "a² − 2ab + b²", "2a + 2b"], 1, "(a + b)² = a² + 2ab + b²."],
      ["Geometry", "What is the sum of the interior angles of a triangle?", ["90°", "180°", "270°", "360°"], 1, "Interior angles of any triangle add up to 180°."],
      ["Geometry", "The area of a circle with radius r is:", ["2πr", "πr²", "πd", "2πr²"], 1, "Area = πr²; 2πr is the circumference."],
      ["Trigonometry", "In a right triangle, sin θ equals:", ["adjacent / hypotenuse", "opposite / hypotenuse", "opposite / adjacent", "hypotenuse / opposite"], 1, "Sine = opposite over hypotenuse (SOH)."],
      ["Trigonometry", "What is the value of cos 0°?", ["0", "0.5", "1", "undefined"], 2, "cos 0° = 1."],
      ["Statistics", "The median of 3, 9, 4, 7, 5 is:", ["4", "5", "6", "7"], 1, "Sorted: 3,4,5,7,9 — the middle value is 5."],
      ["Statistics", "Which measure is most affected by extreme outliers?", ["Median", "Mode", "Mean", "Range midpoint"], 2, "The mean uses every value, so outliers pull it."],
    ]),
  },
  {
    key: "physics",
    match: ["physic", "mechanic", "optics", "electric"],
    topics: ["Motion", "Forces", "Energy", "Waves"],
    q: B([
      ["Motion", "Speed is defined as:", ["mass × acceleration", "distance ÷ time", "force × distance", "velocity × time²"], 1, "Speed = distance travelled per unit time."],
      ["Motion", "An object moving at constant velocity has an acceleration of:", ["Zero", "9.8 m/s²", "Equal to its speed", "Increasing"], 0, "Constant velocity means no change in velocity, so a = 0."],
      ["Forces", "Newton's second law is:", ["F = ma", "E = mc²", "V = IR", "p = mv²"], 0, "Force equals mass times acceleration."],
      ["Forces", "The SI unit of force is the:", ["Joule", "Watt", "Newton", "Pascal"], 2, "1 newton = 1 kg·m/s²."],
      ["Energy", "Kinetic energy is given by:", ["mgh", "½mv²", "Fd", "mv"], 1, "KE = ½ m v²; mgh is gravitational potential energy."],
      ["Energy", "Energy can be:", ["Created but not destroyed", "Destroyed but not created", "Neither created nor destroyed", "Only stored in batteries"], 2, "Conservation of energy: it only changes form."],
      ["Waves", "Sound waves are:", ["Transverse", "Longitudinal", "Electromagnetic", "Not waves"], 1, "Sound compresses and rarefies the medium along its travel direction."],
      ["Waves", "Frequency is measured in:", ["Metres", "Hertz", "Decibels", "Newtons"], 1, "One hertz is one cycle per second."],
    ]),
  },
  {
    key: "chemistry",
    match: ["chem"],
    topics: ["Atomic Structure", "Bonding", "Reactions", "Acids & Bases"],
    q: B([
      ["Atomic Structure", "The number of protons in an atom is its:", ["Mass number", "Atomic number", "Valency", "Isotope count"], 1, "Atomic number = number of protons."],
      ["Atomic Structure", "Electrons carry what charge?", ["Positive", "Negative", "Neutral", "Varies"], 1, "Electrons are negatively charged."],
      ["Bonding", "NaCl is an example of which bond?", ["Covalent", "Ionic", "Metallic", "Hydrogen"], 1, "Sodium donates an electron to chlorine, forming an ionic bond."],
      ["Bonding", "Which type of bond shares electron pairs?", ["Ionic", "Covalent", "Metallic", "Van der Waals"], 1, "Covalent bonds are shared electron pairs."],
      ["Reactions", "In a balanced equation, the number of atoms of each element:", ["Increases on the right", "Is the same on both sides", "Halves", "Doesn't matter"], 1, "Mass is conserved, so atoms balance."],
      ["Reactions", "Rusting of iron is an example of:", ["Reduction only", "Oxidation", "Neutralisation", "Sublimation"], 1, "Iron reacts with oxygen and water — oxidation."],
      ["Acids & Bases", "A solution with pH 3 is:", ["Neutral", "Basic", "Acidic", "A salt"], 2, "pH below 7 is acidic."],
      ["Acids & Bases", "Acid + base typically produces:", ["Salt + water", "Oxygen + hydrogen", "Only gas", "A metal"], 0, "Neutralisation gives a salt and water."],
    ]),
  },
  {
    key: "biology",
    match: ["biolog", "life science", "botany", "zoology"],
    topics: ["Cells", "Genetics", "Human Body", "Ecology"],
    q: B([
      ["Cells", "Which organelle produces most of the cell's ATP?", ["Nucleus", "Mitochondrion", "Ribosome", "Golgi body"], 1, "Mitochondria are the cell's powerhouses."],
      ["Cells", "Plant cells have which structure animal cells lack?", ["Cell membrane", "Cell wall", "Cytoplasm", "Ribosomes"], 1, "Plants have a rigid cellulose cell wall."],
      ["Genetics", "DNA stands for:", ["Deoxyribonucleic acid", "Dinitro-nucleic acid", "Dual nitrogen acid", "Deoxyribose nitrate"], 0, "Deoxyribonucleic acid stores genetic information."],
      ["Genetics", "A pair of identical alleles is called:", ["Heterozygous", "Homozygous", "Recessive only", "A mutation"], 1, "Homozygous = two copies of the same allele."],
      ["Human Body", "Which organ pumps blood around the body?", ["Liver", "Lungs", "Heart", "Kidney"], 2, "The heart is the pump of the circulatory system."],
      ["Human Body", "Red blood cells mainly carry:", ["Antibodies", "Oxygen", "Hormones", "Glucose only"], 1, "Haemoglobin in red cells binds oxygen."],
      ["Ecology", "Producers in a food chain are usually:", ["Herbivores", "Plants", "Decomposers", "Carnivores"], 1, "Plants make food by photosynthesis."],
      ["Ecology", "The process plants use to make glucose from light is:", ["Respiration", "Photosynthesis", "Digestion", "Fermentation"], 1, "Photosynthesis converts light, CO₂ and water into glucose."],
    ]),
  },
  {
    key: "history",
    match: ["histor", "civics", "politic", "social"],
    topics: ["Ancient Civilizations", "Medieval Era", "Revolutions", "Modern World"],
    q: B([
      ["Ancient Civilizations", "Which river was central to ancient Egyptian civilization?", ["Tigris", "Nile", "Indus", "Yangtze"], 1, "The Nile's floods made farming possible in Egypt."],
      ["Ancient Civilizations", "The Indus Valley city of Mohenjo-daro is known for:", ["Pyramids", "Planned streets and drainage", "Great Wall", "Colosseum"], 1, "It had grid-planned streets and advanced drainage."],
      ["Medieval Era", "The Magna Carta (1215) limited the power of:", ["The Pope", "The English king", "Parliament", "Merchants"], 1, "It bound King John to the rule of law."],
      ["Medieval Era", "The Black Death in 14th-century Europe was a:", ["War", "Plague", "Famine only", "Religious reform"], 1, "A plague killed a huge share of Europe's population."],
      ["Revolutions", "The French Revolution began in:", ["1689", "1789", "1848", "1917"], 1, "The storming of the Bastille was in 1789."],
      ["Revolutions", "The Industrial Revolution began in:", ["France", "Britain", "Russia", "Japan"], 1, "Britain led early mechanisation and factories."],
      ["Modern World", "The United Nations was founded in:", ["1919", "1929", "1945", "1991"], 2, "The UN was created after World War II, in 1945."],
      ["Modern World", "India gained independence in:", ["1919", "1935", "1947", "1950"], 2, "India became independent on 15 August 1947."],
    ]),
  },
  {
    key: "geography",
    match: ["geograph", "earth science", "environment"],
    topics: ["Landforms", "Climate", "Resources", "Maps"],
    q: B([
      ["Landforms", "The longest mountain range on land is the:", ["Alps", "Andes", "Rockies", "Himalayas"], 1, "The Andes run about 7,000 km along South America."],
      ["Landforms", "A delta forms where a river:", ["Begins", "Meets the sea and deposits silt", "Freezes", "Flows underground"], 1, "Slowing water drops sediment, building a delta."],
      ["Climate", "The Tropic of Cancer lies at roughly:", ["0°", "23.5° N", "45° N", "66.5° N"], 1, "The Tropic of Cancer is at about 23.5° North."],
      ["Climate", "Monsoons are caused mainly by:", ["Volcanoes", "Seasonal wind reversals", "Tides", "Ocean trenches"], 1, "Land and sea heat differently, reversing winds seasonally."],
      ["Resources", "Which of these is a renewable resource?", ["Coal", "Natural gas", "Solar energy", "Petroleum"], 2, "Sunlight is continually replenished."],
      ["Resources", "Deforestation most directly increases:", ["Soil erosion", "Rainfall", "Biodiversity", "Ozone"], 0, "Roots no longer hold the soil in place."],
      ["Maps", "Lines of longitude run:", ["East–west", "North–south (pole to pole)", "Diagonally", "In circles around the equator only"], 1, "Meridians connect the poles."],
      ["Maps", "A map's scale of 1:50,000 means 1 cm on the map equals:", ["50 m", "500 m", "5 km", "50 km"], 1, "50,000 cm = 500 m."],
    ]),
  },
  {
    key: "computer science & ai",
    match: ["comput", "ai", "artificial", "program", "coding", "software", "machine learning", "data science", "cs"],
    topics: ["Search & Logic", "Machine Learning", "Programming", "Data"],
    q: B([
      ["Search & Logic", "Breadth-first search explores a graph by:", ["Going as deep as possible first", "Visiting all neighbours level by level", "Random jumps", "Sorting nodes"], 1, "BFS expands the frontier one level at a time using a queue."],
      ["Search & Logic", "A heuristic in A* search is used to:", ["Store visited nodes", "Estimate the remaining cost to the goal", "Randomise the path", "Reduce memory to zero"], 1, "h(n) estimates cost to goal and guides the search."],
      ["Machine Learning", "Overfitting means a model:", ["Is too simple", "Memorises training data and generalises poorly", "Trains too fast", "Has no parameters"], 1, "It fits noise in training data and fails on new data."],
      ["Machine Learning", "Supervised learning needs:", ["Labelled examples", "No data", "Only rewards", "A robot"], 0, "Inputs paired with correct outputs."],
      ["Programming", "Which structure is Last-In, First-Out?", ["Queue", "Stack", "Array", "Heap"], 1, "A stack pops the most recently pushed item."],
      ["Programming", "The time complexity of binary search is:", ["O(n)", "O(log n)", "O(n²)", "O(1)"], 1, "It halves the search space each step."],
      ["Data", "A primary key in a database:", ["Can repeat", "Uniquely identifies each row", "Is always text", "Encrypts data"], 1, "It uniquely identifies a record."],
      ["Data", "Which is an example of unstructured data?", ["A spreadsheet", "A relational table", "A photo", "A CSV of numbers"], 2, "Images don't follow a fixed row/column schema."],
    ]),
  },
  {
    key: "english",
    match: ["english", "literature", "language", "grammar", "writing"],
    topics: ["Grammar", "Literary Devices", "Vocabulary", "Comprehension"],
    q: B([
      ["Grammar", "Which sentence is grammatically correct?", ["Their going home.", "They're going home.", "There going home.", "Theyre going home."], 1, "They're = they are."],
      ["Grammar", "A noun names a:", ["Action", "Person, place, thing or idea", "Quality only", "Connection"], 1, "Nouns name people, places, things and ideas."],
      ["Literary Devices", "\"The wind whispered\" is an example of:", ["Simile", "Personification", "Alliteration only", "Hyperbole"], 1, "Giving a human action to the wind is personification."],
      ["Literary Devices", "A simile compares using:", ["'like' or 'as'", "Exaggeration", "Repetition of sounds", "Irony"], 0, "A simile makes an explicit comparison with like/as."],
      ["Vocabulary", "A synonym for 'benevolent' is:", ["Cruel", "Kind", "Lazy", "Hidden"], 1, "Benevolent means well-meaning and kind."],
      ["Vocabulary", "The prefix 'un-' usually means:", ["Again", "Not", "Before", "Under"], 1, "un- reverses or negates the root word."],
      ["Comprehension", "The main idea of a passage is its:", ["Longest sentence", "Central point", "First word", "Title font"], 1, "It's what the passage is mostly about."],
      ["Comprehension", "To 'infer' means to:", ["Copy text", "Conclude from evidence", "Repeat aloud", "Skip ahead"], 1, "Inference draws a conclusion from clues."],
    ]),
  },
  {
    key: "general",
    match: [],
    topics: ["General Knowledge"],
    q: B([
      ["General Knowledge", "Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1, "Iron oxide gives Mars its red colour."],
      ["General Knowledge", "How many continents are there?", ["5", "6", "7", "8"], 2, "By the common convention there are seven."],
      ["General Knowledge", "Which gas do humans need to breathe in?", ["Nitrogen", "Oxygen", "Helium", "Argon"], 1, "We use oxygen for respiration."],
      ["General Knowledge", "The chemical symbol for water is:", ["HO", "H₂O", "O₂H", "H₂O₂"], 1, "Two hydrogen atoms and one oxygen."],
      ["General Knowledge", "Which is the largest ocean?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3, "The Pacific covers about a third of Earth's surface."],
      ["General Knowledge", "The study of living things is called:", ["Geology", "Biology", "Astronomy", "Meteorology"], 1, "Bio = life."],
      ["General Knowledge", "How many minutes are in three hours?", ["120", "150", "180", "210"], 2, "3 × 60 = 180."],
      ["General Knowledge", "Which of these is a prime number?", ["21", "27", "29", "33"], 2, "29 has no divisors other than 1 and itself."],
      ["General Knowledge", "Light travels fastest through:", ["Water", "Glass", "A vacuum", "Air at sea level"], 2, "Light is fastest in a vacuum."],
      ["General Knowledge", "A quadrilateral has how many sides?", ["3", "4", "5", "6"], 1, "Quad = four."],
    ]),
  },
];

export const BANK_SUBJECT_TOPICS = Object.fromEntries(BANK.map((b) => [b.key, b.topics]));

/** Best bank for a subject name; falls back to General Knowledge. */
export function bankFor(subjectName = "") {
  const n = subjectName.toLowerCase();
  const words = n.split(/[^a-z]+/).filter(Boolean);
  for (const b of BANK) {
    if (b.key === "general") continue;
    if (b.match.some((m) => (m.length <= 3 ? words.includes(m) : n.includes(m)))) return b;
  }
  return BANK.find((b) => b.key === "general");
}
