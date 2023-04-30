Reaction
  = lhs:ReactionSide _ arrow:ReactionArrow _ rhs:ReactionSide _ type:ReactionType? {
  	return {
    	type: type,
        lhs: lhs,
        rhs: rhs,
        direction: arrow.direction,
        conditions: arrow.conditions
    };
  }

ReactionSide
  = head:Compound tail:(_ "+" _ Compound)* {
  	let arr = tail.map(elem => elem[3]);
    arr.unshift(head);
    return arr;
  }

ReactionArrow
  = dir:("<"? "-"+ ">"?) up:Condition? down:Condition? {
  	let conditions = {up: [], down: []};
    if (up) conditions.up = up.split(",").map(c => c.trim());
    if (down) conditions.down = down.split(",").map(c => c.trim());
    
    let left = dir[0] == "<";
    let right = dir[dir.length - 1] == ">";

	let direction = left && right ? "reversible" : right ? "right" : "left";
    
    return {
    	direction: direction,
        conditions: conditions
    };
  }

Compound
  = comment:Comment? _ coefficient:Number? elements:Elements _ type:ElementType? {
      return {
      	comment: comment ?? "",
        coefficient: coefficient ?? 1,
        elements: elements,
        type: type
      };
    }

Elements
  = Element+

Element
  = symbol:Symbol index:Number? oxidationState:OxidationState? {
    return {symbol: symbol, index: index ?? 1, oxidationState: oxidationState ?? NaN};
  }

Symbol "chemical symbol"
  = [A-Z][a-z]? { return text(); }

OxidationState "oxidation state"
  = "^" number:([+\-] Number / "0") { return number == 0 ? 0 : parseInt(number.join("")); } 

Number "number"
  = [0-9]+ { return parseInt(text(), 10); }

ReactionType
  = "(" text:("ОРП" / "ЙОП") ")" { return text; }

ElementType
  = "газ" / "утайка" { return text(); }

Condition "condition"
 =  "[" text:Text "]" { return text; }

Comment "comment"
 =  "\"" text:Text "\"" { return text; }

Text "text"
  = [A-Za-zА-Яа-я., ]* { return text(); }

_ "whitespace"
  = [ ]*