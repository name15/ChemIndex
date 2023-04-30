let inputField = document.querySelector("div#markdown-input") as HTMLTextAreaElement;
let errorField = document.querySelector("div#error-message") as HTMLDivElement;
let outputField = document.querySelector("div#markdown-output") as HTMLDivElement;

/* Roadmap:
 * Добави ЙОП
 * Добави к. и р. за киселини
 * Записвай резултатите като готови ANKI карти в CSV формат
 */

/*
interface CaretLocation {
  offset: number;
  line: number;
  column: number;
}

interface Literal {
  type: string;
  text: string;
  ignoreCase: boolean;
}

interface PEGSyntaxError {
  message: string;
  expected: Literal[];
  found: string;
  name: string;
  location: { start: CaretLocation; end: CaretLocation };
}
*/

interface ChemElement {
  symbol: string;
  index: number;
  oxidationState: number;
}

interface ChemCompound {
  comment: string;
  coefficient: number;
  elements: ChemElement[];
  type: "газ" | "утайка" | null;
}

interface ChemReaction {
  type: "ОРП" | "ЙОП" | null;
  lhs: ChemCompound[];
  rhs: ChemCompound[];
  direction: "left" | "right" | "reversible";
  conditions: {
    up: string[];
    down: string[];
  };
}

// @ts-ignore
var editor;

function start() {
  // Code Mirror
  // @ts-ignore
  editor = CodeMirror(inputField, {
    lineNumbers: true,
    tabSize: 2,
    value: "Cl2^0 + H2O -> HCl^-1 + HOCl^+1 (ОРП)",
  });

  editor.setSize("100%", "100%");

  // @ts-ignore
  editor.on("keyup", update);

  update();
}

function update() {
  // Get text at caret position
  // @ts-ignore
  let line: number = editor.getCursor().line;
  // @ts-ignore
  let text: string = editor.doc.getValue();

  let textInput = text.split("\n")[line];

  try {
    // @ts-ignore
    let result: ChemReaction = PEG.parse(textInput);
    console.log(result);
    render(result);
    if (result.type == "ОРП") redox(result);
    if (result.type == "ЙОП") throw "Not jet implemented.";
    check(result);

    errorField.hidden = true;
  } catch (err) {
    errorField.innerText = err.message ? `${err.name}: ${err.message}` : err;
    errorField.hidden = false;
    console.error(err);
  }
}

function elements2tex(elements: ChemElement[]): string {
  return elements
    .map((element) => {
      let index = element.index == 1 ? "" : element.index.toString();
      if (isNaN(element.oxidationState)) return `${element.symbol}${index}`;
      else {
        if (index.length > 0) index = "_" + index;
        let oxidationState =
          element.oxidationState > 0
            ? "+" + element.oxidationState.toString()
            : element.oxidationState.toString();
        return `\\overset{${oxidationState}}{${element.symbol}}${index}`;
      }
    })
    .join("");
}

function compounds2tex(compounds: ChemCompound[]): string {
  return compounds
    .map((compound) => {
      let coefficient = compound.coefficient == 1 ? "" : compound.coefficient;
      let elements = elements2tex(compound.elements);
      let upDownArrow = compound.type == "газ" ? " (^)" : compound.type == "утайка" ? " v" : "";
      if (compound.comment == "") return coefficient + elements + upDownArrow;
      else
        return `\\underset{\\text{${compound.comment}}}{${coefficient}${elements}}${upDownArrow}`;
    })
    .join(" + ");
}

function conditions2tex(conditions: string[]): string {
  return conditions.length == 0 ? "" : "[" + conditions.join(", ") + "]";
}

function reation2tex(reaction: ChemReaction): string {
  let leftRightArrow =
    reaction.direction == "left" ? "<-" : reaction.direction == "right" ? "->" : "<=>";

  return (
    compounds2tex(reaction.lhs) +
    " " +
    leftRightArrow +
    conditions2tex(reaction.conditions.up) +
    conditions2tex(reaction.conditions.down) +
    " " +
    compounds2tex(reaction.rhs)
  );
}

function render(reaction: ChemReaction) {
  let tex = reation2tex(reaction);
  console.log(tex);

  // Clear output field
  while (outputField.firstChild) {
    outputField.removeChild(outputField.lastChild);
  }

  // MathJax magic is incomprehensible for Typescript
  // @ts-ignore
  const mathJaxContainer = MathJax.tex2svg(`\\ce{${tex}}`);
  outputField.appendChild(mathJaxContainer);
}

function countAtoms(compounds: ChemCompound[]) {
  let atomSum: { [key: string]: number } = {};

  compounds.forEach((compound) => {
    let atoms: { [key: string]: number } = {};
    compound.elements.forEach((element) => {
      if (atoms[element.symbol] == undefined) {
        atoms[element.symbol] = element.index;
      } else {
        atoms[element.symbol] += element.index;
      }
    });
    for (let symbol in atoms) {
      if (atomSum[symbol] == undefined) {
        atomSum[symbol] = atoms[symbol] * compound.coefficient;
      } else {
        atomSum[symbol] += atoms[symbol] * compound.coefficient;
      }
    }
  });

  return atomSum;
}

function check(reaction: ChemReaction) {
  let atomsLeft = countAtoms(reaction.lhs);
  let atomsRight = countAtoms(reaction.rhs);

  let symbols = new Set(Object.keys(atomsLeft));
  Object.keys(atomsRight).forEach((key) => symbols.add(key));

  let valid = Array.from(symbols).reduce(
    (prev: boolean, cur: string) => prev && atomsLeft[cur] == atomsRight[cur],
    true
  );

  if (!valid) throw "Balance: The law of conservation of mass is not preserved.";
}

function countElectrons(compounds: ChemCompound[]): ChemElement[] {
  return compounds
    .map(
      (compound) => compound.elements.filter((element) => !isNaN(element.oxidationState))
      //      .map((element) => Object.assign({}, element))
    )
    .flat();
}

const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);

const gcd = (a: number, b: number): number => {
  const remainder = a % b;
  if (remainder === 0) return b;
  return gcd(b, remainder);
};

enum RedoxType {
  Normal,
  Disproportionation,
  Comproportionation,
}

function redox(reaction: ChemReaction) {
  let redoxType = RedoxType.Normal;
  let electronsLeft = countElectrons(reaction.lhs);
  let electronsRight = countElectrons(reaction.rhs);

  if (electronsLeft.length == 0 || electronsRight.length == 0)
    throw "Redox: The oxidation states are not specified on both sides.";

  // Mapping (oversimplified)
  let map: { left: ChemElement; right: ChemElement }[] = [];
  let oxidationFound = false,
    reductionFound = false,
    oneLeft: ChemElement | false = null,
    oneRight: ChemElement | false = null;
  for (let left of electronsLeft) {
    for (let right of electronsRight) {
      if (left.symbol != right.symbol) continue;
      if (left.oxidationState == right.oxidationState) continue;

      if (right.oxidationState > left.oxidationState) {
        if (oxidationFound) continue;
        oxidationFound = true;
      } else {
        if (reductionFound) continue;
        reductionFound = true;
      }

      map.push({ left: left, right: right });

      if (!oneLeft) oneLeft = left;
      else if (oneLeft != left) oneLeft = false;

      if (!oneRight) oneRight = right;
      else if (oneRight != right) oneRight = false;
    }
    if (!oxidationFound && !reductionFound)
      throw `Redox: Please add valid oxidation numbers for '${left.symbol}'.`;
  }

  if (!oxidationFound) throw "Redox: The redox equation does not appear to have an oxidation.";
  if (!reductionFound) throw "Redox: The redox equation does not appear to have a reduction.";

  console.log(map);

  let HONClBrIF = ["H", "O", "N", "Cl", "Br", "I", "F"];

  console.log(oneLeft, oneRight);

  if (oneLeft && HONClBrIF.includes(oneLeft.symbol)) redoxType = RedoxType.Disproportionation;
  if (oneRight && HONClBrIF.includes(oneRight.symbol)) redoxType = RedoxType.Comproportionation;

  let table: { tex: string; difference: number; numElectrons: number }[] = [];

  map.forEach((record) => {
    let numLeft = record.left.oxidationState;
    let numRight = record.right.oxidationState;
    let symbol = record.left.symbol;

    let difference = numLeft - numRight;
    let coefficient = redoxType == RedoxType.Normal && HONClBrIF.includes(symbol) ? 2 : 1;
    let numElectrons = coefficient * Math.abs(difference);

    let coeff = coefficient == 1 ? "" : "2";
    let coeffDot = coefficient == 1 ? "" : "2.";
    let numElectronsStr =
      difference < 0 ? "- " + coeffDot + -difference : "+ " + coeffDot + difference;

    let showPlus = (n: number) => (n <= 0 ? "" : "+") + n;

    let tex =
      `${coeff}\\overset{${showPlus(numLeft)}}{${symbol}}` +
      ` ${numElectronsStr}e^- -> ` +
      `${coeff}\\overset{${showPlus(numRight)}}{${symbol}}`;

    table.push({
      tex: tex,
      difference: difference,
      numElectrons: numElectrons,
    });
  });

  let leastMultiple = lcm(table[0].numElectrons, table[1].numElectrons);

  let texRow = table
    .map(
      (row) =>
        (row.difference > 0 ? "\\text{р.}" : "\\text{ок.}") +
        ` & \\ce{${row.tex}} ` +
        ` & ${row.numElectrons} ` +
        ` & ${leastMultiple / row.numElectrons} &` +
        (row.difference > 0 ? "\\text{окисление}" : "\\text{редукция}") +
        " \\\\ "
    )
    .join("");

  let texTable = `\\begin{array} {rr|r|r|r} ${texRow}\\end{array}`;

  if (redoxType == RedoxType.Disproportionation)
    texTable = `\\displaylines{${texTable} \\\\ \\text{Процесът е диспропорциониране.}}`;
  if (redoxType == RedoxType.Comproportionation)
    texTable = `\\displaylines{${texTable} \\\\ \\text{Процесът е копропорциониране.}}`;

  // MathJax magic is incomprehensible for Typescript
  // @ts-ignore
  const mathJaxContainer = MathJax.tex2svg(texTable);
  outputField.appendChild(mathJaxContainer);
}
