(function() {
    
    
// Function below
var compile;

// Lex/Grammar combo
// regexp, final, callback
var lex = {};

var indexSequence = 0;
var currentIndent = 0;

var labels = {};
var equs = {};
var indexes = {};

//for local scoping inside loops
var indexList = ["i"];

var addIndent = function(code) {
    var ind="";
    for (var i=0;i<currentIndent;i++) {
        ind+="  ";
    }
    return code.replace(/\n/g,"\n"+ind);
}

lex.block = [
    [/^\s+/,true,function(m) {
        return "";
    }],
    [/^ORG\s+(.*)/i,true,function(m) {
        return addIndent("\nstartingLine = "+compile(lex.arg,m[1])+";");
    }],
    [/^END\s+(.*)/i,true,function(m) {
        var c = compile(lex.arg,m[1]);
        if (c.length) return addIndent("\nstartingLine = "+c+"+1;");
        return "";
    }],
    
    [/^ROF([^a-zA-z0-9_]+|\n|$)/i,true,function(m) {
        currentIndent--;
        indexList.pop();
        return addIndent("\n}");
    }],
    
    [/^(([a-zA-Z0-9_]+)\:?\s+)?FOR\s+(.*)/i,true,function(m) {
        
        indexSequence++;
        var indexName = "loopi_"+indexSequence;
        //if the index is named
        if (m[1]) {
            indexName = "loop_"+m[2];
            indexes[m[2]]=indexName;
        }
        indexList.push(indexName);
        
        
        var ret = addIndent("\nfor (var "+indexName+"=1;"+indexName+"<=("+compile(lex.arg,m[3])+");"+indexName+"++) {");
        currentIndent++;
        
        return ret;
    }],
    
    
    [/^([a-zA-Z0-9_]+)\:?\s+EQU\s+(.*)((\n\s*EQU\s+.*)*)/i,true,function(m) {
        var cnt = m[2]+"\n"+m[3].replace(/(^|\n)\s*EQU\s+/ig,"$1");

        equs[m[1]] = 1;
        
        
        //Do we have a block with instructions or with just an expression?
        if (cnt.match(/^\s*(DAT|MOV|ADD|SUB|MUL|DIV|MOD|JMP|JMZ|JMN|DJN|CMP|SLT|SPL|ORG|END)(\.(A|B|AB|BA|F|X|I))?\s+(.*)/i)) {
            
            currentIndent++;
            var ret = "\nequ['"+m[1]+"'] = function() { "+compile(lex.block,cnt)+"\n}";
            currentIndent--;

        } else {
            var ret = "\nequ['"+m[1]+"'] = function() { return "+compile(lex.arg,cnt)+";}";
            
        }
        
        
        return addIndent(ret);
    }],
    
    [/^(DAT|MOV|ADD|SUB|MUL|DIV|MOD|JMP|JMZ|JMN|DJN|CMP|SLT|SPL|ORG|END)(\.(A|B|AB|BA|F|X|I))?\s+(.*)/i,true,function(m) {
        return addIndent("\nlines[i]=[['"+m[1]+"','"+(m[3]||'F')+"'],"+compile(lex.args,m[4])+"]; i++;");
        
    }],
    [/^([a-zA-Z0-9_]+)\:?/,true,function(m) {
        if (equs[m[1]]) {
            return addIndent("\nequ['"+m[1]+"']();");
        }
        return "\nlabels['"+m[1]+"'] = i;";
    }],
    [/^.*/,true,function(m) {
        return addIndent("// "+m[0]);
    }]
];

lex.args = [
    // whitespace
    [/^\s+/,true,function(m) {
        return "";
    }],
    // mode expr, mode expr
    [/^([\#\$\@\*\<\>\{\}]?)\s*([^\,]+?)\s*\,\s*([\#\$\@\*\<\>\{\}]?)\s*(.*)/,true,function(m) {
        return "['"+(m[1]||'$')+"',(function("+indexList.join(",")+") { return function() { return "+compile(lex.arg,m[2])+"};})("+indexList.join(",")+")],['"+(m[3]||'$')+"',(function("+indexList.join(",")+") { return function() { return "+compile(lex.arg,m[4])+"};})("+indexList.join(",")+")]";
    }],
    // mode expr
    [/^([\#\$\@\*\<\>\{\}]?)\s*([^\,]+)\s*/,true,function(m) {
        return "['"+(m[1]||'$')+"',(function("+indexList.join(",")+") { return function() { return "+compile(lex.arg,m[2])+"};})("+indexList.join(",")+")],null";
    }],
    [/^.*/,true,function(m) {
           return "/* ARGS "+m[0]+" */";
    }],
];

lex.arg = [
    [/^\s+/,true,function(m) {
        return "";
    }],
    [/^[\(\)\+\-\=\!\&\|\<\>\*\/\%0-9]+/,true,function(m) {
        return m[0];
    }],
    [/^([a-zA-Z0-9_]+)/,true,function(m) {
        
        if (indexes[m[0]]) {
            return "loop_"+m[0];
        }
        
        // label-i because all addresses are relative
        return "getLabel('"+m[0]+"',i)";
    }],
    [/^.*/,true,function(m) {
           return "/* ARG "+m[0]+" */";
    }],
];


var compile = function(lex,code) {
    
    
    //Remove comments and whitespace
    code = code.replace(/\;.*/g,"");
    code = code.replace(/[ \t]+/g," ");
    
    
    var compiled = "";
    var parsing = code+"";
    
    var regexp,isfinal,cb,matches;
    
    while (parsing.length) {
        //console.log("XXXXXXXX",parsing);
        for (var y=0;y<lex.length;y++) {
            
            regexp = lex[y][0];
            isfinal = lex[y][1];
            cb = lex[y][2];
            
            matches = parsing.match(regexp);
            if (matches) {
                if (isfinal) {
                    compiled += cb(matches);
                    parsing = parsing.replace(regexp,"");
                } else {
                    parsing = parsing.replace(regexp,cb(matches));
                }
                break;
            }
        }
        
    }
    
    return compiled;
    
};


var preparse = function(redcode,options) {
    
    var compiled=compile(lex.block,redcode);

    if (options) {
        labels["CORESIZE"]=options["CORESIZE"] || 8000;
    }

    compiled="var i=0,labels={},indexes={},equ={},lines=[],startingLine=0;"+
    "\nvar getLabel=function(label,i) {"+
    "\n  if (equ[label]) return equ[label]();"+
    "\n  return labels[label]-i;"+
    "\n}\n"+
    compiled;

    return compiled;
}

var parse = function(redcode,options) {
    
    eval(preparse(redcode,options));
    
    //After evaluating the preparsed code, we resolve the expressions
    for (var i=0;i<lines.length;i++) {
        lines[i] = [lines[i][0],[lines[i][1][0],lines[i][1][1](i)],lines[i][2]?[lines[i][2][0],lines[i][2][1](i)]:null];
    }

    return {
        "lines":lines,
        "start":startingLine
    };
}



exports.parse = parse;
exports.preparse = preparse;


})();