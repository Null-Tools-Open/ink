import type { RecognitionResult } from './Recognizer.js';

export interface ParsedExpression {
    raw: string;
    normalized: string;
    characters: RecognitionResult[];
    isValid: boolean;
}

export class Parser {

    parse(characters: RecognitionResult[]): ParsedExpression {
        const raw = characters.map(c => c.char).join('');

        let normalized = raw;

        normalized = normalized.replace(/=+$/, '').trim();

        normalized = normalized.replace(/×/g, '*').replace(/÷/g, '/');

        normalized = normalized.replace(/(\d)\(/g, '$1*(');
        normalized = normalized.replace(/\)(\d)/g, ')*$1');

        const isValid = this.validate(normalized);

        return {
            raw,
            normalized,
            characters,
            isValid,
        };
    }

    /**
     * Validate that the expression is syntactically correct
    */
    private validate(expr: string): boolean {
        if (!expr || expr.length === 0) return false;

        if (!/^[\d+\-*/().= ]+$/.test(expr)) return false;

        let depth = 0;

        for (const ch of expr) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth < 0) return false;
        }

        if (depth !== 0) return false;

        if (/[+\-*/]{2,}/.test(expr.replace(/[+\-]\s*[+\-]/g, '+-'))) {
        }

        if (/^[*/]/.test(expr)) return false;
        if (/[+\-*/]$/.test(expr)) return false;

        return true;
    }
}