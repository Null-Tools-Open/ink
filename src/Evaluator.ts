export class Evaluator {

    evaluate(expr: string): number {
        const tokens = this.tokenize(expr);
        const result = this.parseExpression(tokens, { pos: 0 });
        return result;
    }

    /**
     * Tokenize expression into numbers and operators
    */
    private tokenize(expr: string): string[] {
        const tokens: string[] = [];
        let i = 0;
        const s = expr.replace(/\s/g, '');

        while (i < s.length) {
            if (s[i] >= '0' && s[i] <= '9' || s[i] === '.') {
                let num = '';
                while (i < s.length && (s[i] >= '0' && s[i] <= '9' || s[i] === '.')) {
                    num += s[i];
                    i++;
                }
                tokens.push(num);
            } else if ('+-*/()'.includes(s[i])) {
                tokens.push(s[i]);
                i++;
            } else {
                i++; // skip unknown chars
            }
        }

        return tokens;
    }

    /**
     * Recursive descent parser: Expression = Term (('+' | '-') Term)*
    */
    private parseExpression(tokens: string[], ctx: { pos: number }): number {
        let left = this.parseTerm(tokens, ctx);

        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (op !== '+' && op !== '-') break;
            ctx.pos++;
            const right = this.parseTerm(tokens, ctx);
            left = op === '+' ? left + right : left - right;
        }

        return left;
    }

    /**
     * Term = Factor (('*' | '/') Factor)*
    */
    private parseTerm(tokens: string[], ctx: { pos: number }): number {
        let left = this.parseFactor(tokens, ctx);

        while (ctx.pos < tokens.length) {
            const op = tokens[ctx.pos];
            if (op !== '*' && op !== '/') break;
            ctx.pos++;
            const right = this.parseFactor(tokens, ctx);
            left = op === '*' ? left * right : left / right;
        }

        return left;
    }

    /**
     * Factor = Number | '(' Expression ')' | UnaryMinus Factor
    */
    private parseFactor(tokens: string[], ctx: { pos: number }): number {
        const token = tokens[ctx.pos];

        if (token === '-') {
            ctx.pos++;
            return -this.parseFactor(tokens, ctx);
        }

        if (token === '+') {
            ctx.pos++;
            return this.parseFactor(tokens, ctx);
        }

        if (token === '(') {
            ctx.pos++;
            const result = this.parseExpression(tokens, ctx);
            if (tokens[ctx.pos] === ')') {
                ctx.pos++;
            }
            return result;
        }

        ctx.pos++;
        const num = parseFloat(token);
        if (isNaN(num)) return 0;
        return num;
    }
}