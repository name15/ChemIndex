Reaction
  = lhs:ReactionSide _ "->" _ rhs:ReactionSide {
  	return {lhs: lhs, rhs: rhs};
  }

ReactionSide
  = head:Compound tail:(_ "+" _ Compound)* {
  	let arr = tail.map(elem => elem[3]);
    arr.unshift(head);
    return arr;
  }

Compound
  = coefficient:Number? elements:Elements {
      return {coefficient: coefficient ?? 1, elements: elements};
    }

Elements
  = Element+

Element
  = symbol:Symbol index:Number? {
    return {symbol: symbol, index: index ?? 1};
  }

Symbol "chemical symbol"
  = [A-Z][a-z]? { return text(); }

Number "number"
  = [0-9]+ { return parseInt(text(), 10); }

_ "whitespace"
  = [ \\t\\n\\r]*