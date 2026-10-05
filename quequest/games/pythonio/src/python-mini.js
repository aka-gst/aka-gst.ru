/* A deliberately small, bounded interpreter for teaching Python control flow.
 * NOT CPython / Pyodide / a complete Python implementation.
 * No eval, Function, imports, host properties, file I/O or external libraries.
 * The supported language and its limits are documented in docs/PYTHON.md.
 */
(function (g, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else g.WorkshopPython = factory();
})(globalThis, function runtime() {
    'use strict';
    const LIMITS = Object.freeze({ source: 12000, lines: 400, depth: 32, steps: 20000, collection: 256, string: 8192, number: 1e12, tokens: 512, valueSize: 16384, expressionDepth: 128 });
    class PythonError extends Error {
        constructor(code, message, line = 1) { super(message); this.name = code; this.code = code; this.line = line; }
    }
    const error = (code, message, line) => { throw new PythonError(code, message, line); };
    const syntax = (message, line) => error('SyntaxError', message, line);
    const safeName = (s, line) => { if (s.startsWith('__') || ['constructor', 'prototype'].includes(s)) syntax('Служебные имена здесь недоступны.', line); return s; };
    const callable = new Set(['range', 'len', 'sum', 'str', 'int', 'bool', 'print']);
    const reserved = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '));
    function binding(s,line) { safeName(s,line); if(reserved.has(s)||callable.has(s)) syntax('Это имя зарезервировано. Выбери другое имя переменной.',line); return s; }
    function tokenize(text, line) {
        const out = []; let i = 0;
        while (i < text.length) {
            if(out.length>LIMITS.tokens)error('LimitError','Выражение слишком длинное. Разбей его на несколько переменных.',line);
            const c = text[i];
            if (/\s/.test(c)) { i++; continue; }
            if (c === '#') break;
            if (c === '"' || c === "'") {
                const q = c; let value = ''; i++; let closed = false;
                while (i < text.length) {
                    const d = text[i++];
                    if (d === q) { closed = true; break; }
                    if (d === '\\') {
                        const e = text[i++], map = {n:'\n', t:'\t', r:'\r', '\\':'\\', "'":"'", '"':'"'};
                        if (e === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i,i+4))) { value += String.fromCharCode(parseInt(text.slice(i,i+4),16)); i+=4; }
                        else if (Object.hasOwn(map,e)) value += map[e];
                        else syntax('Неподдерживаемая escape-последовательность в строке.', line);
                    } else value += d;
                }
                if (!closed) syntax('Закрой кавычки строки.', line);
                out.push({t:'literal',v:value}); continue;
            }
            const number = text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
            if (number) { const n = Number(number[0]); if (n > LIMITS.number) error('LimitError','Слишком большое число.',line); out.push({t:'literal',v:n}); i += number[0].length; continue; }
            const name = text.slice(i).match(/^[A-Za-z_\u0400-\u04ff][\w\u0400-\u04ff]*/);
            if (name) { out.push({t:'name',v:safeName(name[0],line)}); i+=name[0].length; continue; }
            const op = text.slice(i).match(/^(==|!=|<=|>=|\/\/|[+\-*\/%<>()\[\]{},:])/);
            if (op) { out.push({t:'op',v:op[0]}); i+=op[0].length; continue; }
            syntax(c === '.' ? 'Атрибуты и методы не входят в этот учебный язык. Используй item["type"].' : 'Неожиданный символ «'+c+'».', line);
        }
        out.push({t:'eof',v:''}); return out;
    }
    function expression(text, line) {
        const tokens = tokenize(text,line); let i=0,depth=0;
        const peek=()=>tokens[i],take=()=>tokens[i++],is=v=>peek().v===v;
        const eat=v=>{if(is(v)){i++;return true;}return false;};
        const want=v=>{if(!eat(v))syntax('Ожидалось «'+v+'».',line);};
        const ast=(kind,fields)=>({kind,line,...fields});
        function nested(fn) { if(++depth>LIMITS.depth)error('LimitError','Слишком глубокая вложенность.',line); const v=fn(); depth--;return v; }
        function or(){let a=and();while(eat('or'))a=ast('binary',{op:'or',a,b:and()});return a;}
        function and(){let a=not();while(eat('and'))a=ast('binary',{op:'and',a,b:not()});return a;}
        function not(){return eat('not')?nested(()=>ast('unary',{op:'not',a:not()})):compare();}
        function compare(){const first=add(),parts=[];while(true){let op=peek().v;if(['==','!=','<','>','<=','>=','in','is'].includes(op)){take();if(op==='is'&&eat('not'))op='is not';}else if(op==='not'&&tokens[i+1]?.v==='in'){i+=2;op='not in';}else break;parts.push({op,b:add()});}return parts.length?ast('compare',{first,parts}):first;}
        function add(){let a=mul();while(['+','-'].includes(peek().v)){const op=take().v;a=ast('binary',{op,a,b:mul()});}return a;}
        function mul(){let a=unary();while(['*','/','//','%'].includes(peek().v)){const op=take().v;a=ast('binary',{op,a,b:unary()});}return a;}
        function unary(){if(eat('-'))return nested(()=>ast('unary',{op:'-',a:unary()}));if(eat('+'))return nested(()=>ast('unary',{op:'+',a:unary()}));return atom();}
        function seq(end){const list=[];if(eat(end))return list;while(true){list.push(nested(or));if(eat(end))break;want(',');if(eat(end))break;if(list.length>LIMITS.collection)error('LimitError','Слишком длинная коллекция.',line);}return list;}
        function atom(){let a;const t=take();
            if(t.t==='literal')a=ast('literal',{value:t.v});
            else if(['True','False','None'].includes(t.v))a=ast('literal',{value:t.v==='None'?null:t.v==='True'});
            else if(t.v==='('){a=nested(or);want(')');}
            else if(t.v==='[')a=ast('list',{values:seq(']')});
            else if(t.v==='{'){const values=[];if(!eat('}'))while(true){const key=nested(or);want(':');const value=nested(or);values.push([key,value]);if(eat('}'))break;want(',');if(eat('}'))break;if(values.length>LIMITS.collection)error('LimitError','Словарь слишком большой.',line);}a=ast('dict',{values});}
            else if(t.t==='name'){
                if(eat('(')){if(!callable.has(t.v))syntax('Функция «'+t.v+'» не поддерживается. Здесь доступны '+[...callable].join(', ')+'.',line);a=ast('call',{name:t.v,args:seq(')')});}
                else a=ast('name',{name:t.v});
            }else syntax('Нужно значение, имя или выражение.',line);
            while(eat('[')){const key=nested(or);want(']');a=ast('index',{a,key});}
            return a;
        }
        if(!text.trim())syntax('После условия или оператора нужно выражение.',line);
        const value=or();if(peek().t!=='eof')syntax('Лишнее слово или оператор «'+peek().v+'».',line);return value;
    }
    function stripComment(s){let q=null,escaped=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===q)q=null;}else if(c==='"'||c==="'")q=c;else if(c==='#')return s.slice(0,i);}return s;}
    function parse(source) {
        if(typeof source!=='string'||source.length>LIMITS.source)error('LimitError','Программа должна быть короче 12 000 символов.',1);
        const raw=source.replace(/\r\n?/g,'\n').split('\n');if(raw.length>LIMITS.lines)error('LimitError','Слишком много строк.',1);
        const lines=[];raw.forEach((s,i)=>{s=stripComment(s).trimEnd();if(!s.trim())return;if(s.includes('\t'))error('IndentationError','Используй пробелы вместо табуляции. Клавиша Tab в редакторе добавляет четыре пробела.',i+1);lines.push({line:i+1,indent:s.length-s.trimStart().length,text:s.trimStart()});});
        if(!lines.length||lines[0].indent!==0||!/^def\s+route\s*\(\s*item\s*\)\s*:$/.test(lines[0].text))syntax('Начни с def route(item): — это имя нашей функции.',lines[0]?.line||1);
        let pos=1;
        function block(parent,depth,loop){if(depth>LIMITS.depth)error('LimitError','Слишком много вложенных блоков.',lines[pos]?.line||1);if(pos>=lines.length||lines[pos].indent<=parent)error('IndentationError','Внутри блока нужен отступ и хотя бы одна команда.',lines[pos]?.line||lines[pos-1].line);const indent=lines[pos].indent,body=[];
            while(pos<lines.length&&lines[pos].indent>parent){const l=lines[pos];if(l.indent!==indent)error('IndentationError','Выровняй отступы команд одного блока.',l.line);pos++;const t=l.text;
                const stmt=(kind,fields={})=>({kind,line:l.line,...fields});
                if(/^if\b/.test(t)){
                    if(!t.endsWith(':'))syntax('В конце if нужно двоеточие.',l.line);
                    const arms=[{test:expression(t.slice(2,-1).trim(),l.line),body:block(indent,depth+1,loop)}];let otherwise=[];
                    while(pos<lines.length&&lines[pos].indent===indent&&/^elif\b/.test(lines[pos].text)){const a=lines[pos++];if(!a.text.endsWith(':'))syntax('В конце elif нужно двоеточие.',a.line);arms.push({test:expression(a.text.slice(4,-1).trim(),a.line),body:block(indent,depth+1,loop)});}
                    if(pos<lines.length&&lines[pos].indent===indent&&/^else\b/.test(lines[pos].text)){const a=lines[pos++];if(a.text!=='else:')syntax('Напиши else:',a.line);otherwise=block(indent,depth+1,loop);}
                    body.push(stmt('if',{arms,otherwise}));
                } else if(/^for\b/.test(t)){
                    const m=t.match(/^for\s+([A-Za-z_\u0400-\u04ff][\w\u0400-\u04ff]*)\s+in\s+(.+):$/);if(!m)syntax('Напиши for имя in последовательность:',l.line);body.push(stmt('for',{name:binding(m[1],l.line),expr:expression(m[2],l.line),body:block(indent,depth+1,true)}));
                } else if(/^while\b/.test(t)){
                    if(!t.endsWith(':'))syntax('В конце while нужно двоеточие.',l.line);body.push(stmt('while',{test:expression(t.slice(5,-1).trim(),l.line),body:block(indent,depth+1,true)}));
                } else if(/^return(?:\s|$)/.test(t))body.push(stmt('return',{expr:t.slice(6).trim()?expression(t.slice(6).trim(),l.line):{kind:'literal',value:null,line:l.line}}));
                else if(['pass','break','continue'].includes(t)){if(t!=='pass'&&!loop)syntax(t+' можно писать только внутри цикла.',l.line);body.push(stmt(t));}
                else {
                    const m=t.match(/^([A-Za-z_\u0400-\u04ff][\w\u0400-\u04ff]*)\s*(\+=|-=|\*=|=(?!=))\s*(.+)$/);
                    if(m){const name=binding(m[1],l.line);if(name==='item')syntax('item — входной файл; используй другое имя для переменной.',l.line);const value=expression(m[3],l.line);body.push(stmt('set',{name,expr:m[2]==='='?value:{kind:'binary',op:m[2][0],a:{kind:'name',name,line:l.line},b:value,line:l.line}}));}
                    else if(/^print\s*\(/.test(t))body.push(stmt('expr',{expr:expression(t,l.line)}));
                    else syntax('Эта команда не входит в учебный Python. Доступны if, elif, else, for, while, return и присваивание.',l.line);
                }
            }
            return body;
        }
        const body=block(0,0,false);if(pos!==lines.length)syntax('В этом редакторе пишется только функция route(item).',lines[pos].line);return {body};
    }
    function truth(v){if(v===null||v===false||v===0||v==='')return false;if(Array.isArray(v))return v.length>0;if(v&&typeof v==='object')return Object.keys(v).length>0;return true;}
    function execute(tree,item){let steps=0,output='',exprDepth=0;const shapes=new WeakMap();const env=Object.create(null);env.item=Object.assign(Object.create(null),item);
        function step(line){if(++steps>LIMITS.steps)error('LimitError','Программа остановлена: слишком много действий. Проверь условие цикла — изменяется ли оно?',line);}
        function shape(v,line) {
            if(v===null||typeof v!=='object')return {size:typeof v==='string'?v.length:1,depth:0};
            if(shapes.has(v))return shapes.get(v);
            const values=Array.isArray(v)?v:Object.values(v);
            if(values.length>LIMITS.collection)error('LimitError','В коллекции слишком много элементов.',line);
            let size=1,depth=1;
            for(const child of values){const m=shape(child,line);size+=m.size;depth=Math.max(depth,m.depth+1);if(size>LIMITS.valueSize||depth>LIMITS.depth)error('LimitError','Вложенные коллекции слишком велики. Упрости данные.',line);}
            if(!Array.isArray(v))size+=Object.keys(v).join('').length;
            if(size>LIMITS.valueSize)error('LimitError','Словарь слишком большой.',line);
            const m={size,depth};shapes.set(v,m);return m;
        }
        function checked(v,line){if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>LIMITS.number))error('LimitError','Число выходит за учебный диапазон.',line);if(typeof v==='string'&&v.length>LIMITS.string)error('LimitError','Строка слишком большая.',line);shape(v,line);return v;}
        const numeric=(v,line)=>{if(typeof v==='boolean')return Number(v);if(typeof v!=='number')error('TypeError','Здесь нужно число, а не строка или коллекция.',line);return v;};
        function equal(a,b){step(1);if(typeof a==='number'&&typeof b==='boolean'||typeof b==='number'&&typeof a==='boolean')return Number(a)===Number(b);if(a===b)return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((x,i)=>equal(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){const k=Object.keys(a);return k.length===Object.keys(b).length&&k.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}return false;}
        function representation(v,quote=false){step(1);if(v===null)return 'None';if(v===true)return 'True';if(v===false)return 'False';if(typeof v==='string')return quote?"'"+v.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t')+"'":v;if(Array.isArray(v))return '['+v.map(x=>representation(x,true)).join(', ')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).map(k=>representation(k,true)+': '+representation(v[k],true)).join(', ')+'}';return String(v);}
        function op(operator,a,b,line){
            if(operator==='=='||operator==='!='){const e=equal(a,b);return operator==='=='?e:!e;}
            if(operator==='is'||operator==='is not'){if(![null,true,false].includes(b))error('TypeError','В учебной версии is применяется только к None/True/False.',line);return operator==='is'?a===b:a!==b;}
            if(operator==='in'||operator==='not in'){let v;if(Array.isArray(b))v=b.some(x=>equal(a,x));else if(typeof b==='string'){if(typeof a!=='string')error('TypeError','В строке можно искать только строку.',line);v=b.includes(a);}else if(b&&typeof b==='object')v=typeof a==='string'&&Object.hasOwn(b,a);else error('TypeError','Справа от in нужна последовательность или словарь.',line);return operator==='in'?v:!v;}
            if(['<','>','<=','>='].includes(operator)){if(!(typeof a==='string'&&typeof b==='string')){a=numeric(a,line);b=numeric(b,line);}return operator==='<'?a<b:operator==='>'?a>b:operator==='<='?a<=b:a>=b;}
            if(operator==='+'){if(typeof a==='string'&&typeof b==='string')return checked(a+b,line);if(Array.isArray(a)&&Array.isArray(b))return checked([...a,...b],line);}
            if(operator==='*'&&(typeof a==='string'||Array.isArray(a)||typeof b==='string'||Array.isArray(b))){let seq=a,n=b;if(typeof a==='number'||typeof a==='boolean'){seq=b;n=a;}n=numeric(n,line);if(!Number.isInteger(n))error('TypeError','Для повторения нужно целое число.',line);n=Math.max(0,n);if(n*seq.length>(typeof seq==='string'?LIMITS.string:LIMITS.collection))error('LimitError','Повторение создаёт слишком большой результат.',line);if(!seq.length)return typeof seq==='string'?'':[];return typeof seq==='string'?seq.repeat(n):Array.from({length:n},()=>seq).flat();}
            a=numeric(a,line);b=numeric(b,line);if(['/','//','%'].includes(operator)&&b===0)error('ZeroDivisionError','На ноль делить нельзя.',line);
            return checked(operator==='+'?a+b:operator==='-'?a-b:operator==='*'?a*b:operator==='/'?a/b:operator==='//'?Math.floor(a/b):a-Math.floor(a/b)*b,line);
        }
        function expr(e){if(++exprDepth>LIMITS.expressionDepth)error('LimitError','Слишком сложное выражение.',e.line);try{return checked(evaluate(e),e.line);}finally{exprDepth--;}}
        function evaluate(e){step(e.line);switch(e.kind){
            case 'literal':return e.value;
            case 'name':if(!Object.hasOwn(env,e.name))error('NameError','Имя «'+e.name+'» ещё не задано. Проверь написание.',e.line);return env[e.name];
            case 'list':return e.values.map(expr);
            case 'dict':{const v=Object.create(null);for(const [k,a] of e.values){const key=expr(k);if(typeof key!=='string')error('TypeError','В учебном словаре ключи — строки.',e.line);v[key]=expr(a);}return v;}
            case 'index':{const v=expr(e.a),rawKey=expr(e.key),k=(Array.isArray(v)||typeof v==='string')&&typeof rawKey==='boolean'?Number(rawKey):rawKey;if(Array.isArray(v)||typeof v==='string'){if(!Number.isInteger(k))error('TypeError','Индекс должен быть целым числом.',e.line);const seq=typeof v==='string'?[...v]:v;const i=k<0?seq.length+k:k;if(i<0||i>=seq.length)error('IndexError','Такого элемента нет.',e.line);return seq[i];}if(v&&typeof v==='object'){if(typeof k!=='string'||!Object.hasOwn(v,k))error('KeyError','В словаре нет ключа «'+String(k)+'». У item есть type, ready и checked.',e.line);return v[k];}error('TypeError','Квадратные скобки нужны для списка, строки или словаря.',e.line);break;}
            case 'unary':{const a=expr(e.a);return e.op==='not'?!truth(a):checked((e.op==='-'?-1:1)*numeric(a,e.line),e.line);}
            case 'binary':{const a=expr(e.a);if(e.op==='and')return truth(a)?expr(e.b):a;if(e.op==='or')return truth(a)?a:expr(e.b);return op(e.op,a,expr(e.b),e.line);}
            case 'compare':{let a=expr(e.first);for(const part of e.parts){const b=expr(part.b);if(!op(part.op,a,b,e.line))return false;a=b;}return true;}
            case 'call':{const args=e.args.map(expr),n=e.name;const arity=(min,max=min)=>{if(args.length<min||args.length>max)error('TypeError',n+' получил неверное число аргументов.',e.line);};
                if(n==='print'){output+=args.map(x=>representation(x)).join(' ')+'\n';if(output.length>4096)error('LimitError','Слишком много вывода. Убери print из большого цикла.',e.line);return null;}
                if(n==='range'){arity(1,3);let [start,end,delta]=args.length===1?[0,args[0],1]:[args[0],args[1],args[2]??1];if(![start,end,delta].every(v=>typeof v==='number'&&Number.isInteger(v))||!delta)error('ValueError','range ждёт целые числа и ненулевой шаг.',e.line);const length=Math.max(0,Math.ceil((end-start)/delta));if(length>LIMITS.collection)error('LimitError','В учебном range максимум 256 элементов.',e.line);return Array.from({length},(_,i)=>checked(start+i*delta,e.line));}
                if(n==='len'){arity(1);const v=args[0];if(v===null||!['object','string'].includes(typeof v))error('TypeError','len нужен для строки, списка или словаря.',e.line);return typeof v==='string'?[...v].length:Array.isArray(v)?v.length:Object.keys(v).length;}
                if(n==='sum'){arity(1);if(!Array.isArray(args[0]))error('TypeError','sum ждёт список.',e.line);return args[0].reduce((a,b)=>checked(a+numeric(b,e.line),e.line),0);}
                if(n==='bool'){arity(1);return truth(args[0]);}if(n==='str'){arity(1);return checked(representation(args[0]),e.line);}
                if(n==='int'){arity(1);const v=args[0];if(typeof v==='string'&&!/^[-+]?\d+$/.test(v.trim())||!['number','string','boolean'].includes(typeof v))error('ValueError','int не смог прочитать целое число.',e.line);return checked(Math.trunc(Number(v)),e.line);}break;
            }
        }syntax('Неизвестная операция.',e.line);}
        function body(stmts){for(const s of stmts){step(s.line);switch(s.kind){
            case 'return':return {kind:'return',value:expr(s.expr)};
            case 'set':env[s.name]=expr(s.expr);break;
            case 'expr':expr(s.expr);break;
            case 'break':case 'continue':return {kind:s.kind};
            case 'if':{let selected=s.otherwise;for(const a of s.arms)if(truth(expr(a.test))){selected=a.body;break;}const r=body(selected);if(r)return r;break;}
            case 'for':{const seq=expr(s.expr),values=typeof seq==='string'?[...seq]:Array.isArray(seq)?seq:seq&&typeof seq==='object'?Object.keys(seq):null;if(!values)error('TypeError','for ждёт последовательность.',s.line);if(s.name==='item')syntax('Не используй item как счётчик.',s.line);for(const v of values){step(s.line);env[s.name]=v;const r=body(s.body);if(r?.kind==='return')return r;if(r?.kind==='break')break;}break;}
            case 'while':while(truth(expr(s.test))){step(s.line);const r=body(s.body);if(r?.kind==='return')return r;if(r?.kind==='break')break;}break;
            case 'pass':break;
        }}return null;}
        const result=body(tree.body);return {value:result?.value??null,steps,output};
    }
    function run(source,item){return execute(parse(source),item);}
    const key=item=>`${item.type}:${item.ready?1:0}:${item.checked?1:0}`;
    function compileRouter(source){const tree=parse(source),table=Object.create(null),cases=[];for(const type of ['image','text'])for(const ready of [false,true])for(const checked of [false,true]){const item={type,ready,checked};const r=execute(tree,item);if(r.value!==null&&!['photo','writer','check','out','cache','template','table'].includes(r.value))error('ValueError','route должна вернуть photo, writer, check, out, cache, template, table или None, а вернула '+(Array.isArray(r.value)?'список':typeof r.value==='object'?'словарь':String(r.value).slice(0,100))+'.',1);table[key(item)]=r.value;cases.push({item,result:r.value,steps:r.steps,output:r.output});}return {source,table,cases};}
    function workerSource(){return 'const P=('+runtime.toString()+')();self.onmessage=e=>{try{self.postMessage({ok:true,result:P.compileRouter(e.data)});}catch(x){self.postMessage({ok:false,error:{code:x.code||"Error",message:x.message,line:x.line||1}});}};';}
    function checkAsync(source){return new Promise((resolve,reject)=>{let worker,url,timer;const clean=()=>{clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url);};try{url=URL.createObjectURL(new Blob([workerSource()],{type:'application/javascript'}));worker=new Worker(url);timer=setTimeout(()=>{clean();reject(new PythonError('LimitError','Время проверки истекло. Упрости программу.',1));},2000);worker.onmessage=e=>{clean();if(e.data.ok)resolve(e.data.result);else reject(new PythonError(e.data.error.code,e.data.error.message,e.data.error.line));};worker.onerror=()=>{clean();reject(new PythonError('RuntimeError','Браузер не запустил изолированную проверку. Попробуй другую вкладку или браузер.',1));};worker.postMessage(source);}catch(e){clean();try{resolve(compileRouter(source));}catch(x){reject(x);}}});}
    return {LIMITS,PythonError,parse,run,compileRouter,key,checkAsync};
});
