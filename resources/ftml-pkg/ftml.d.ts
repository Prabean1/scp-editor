/* tslint:disable */
/* eslint-disable */

export class HtmlOutput {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    backlinks(): any;
    body(): string;
    copy(): HtmlOutput;
    html_meta(): any;
}

export class PageInfo {
    free(): void;
    [Symbol.dispose](): void;
    copy(): PageInfo;
    constructor(info: any);
    readonly alt_title: string | undefined;
    readonly category: string | undefined;
    readonly language: string;
    readonly page: string;
    readonly score: number;
    readonly site: string;
    readonly tags: any;
    readonly title: string;
}

export class ParseOutcome {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    copy(): ParseOutcome;
    errors(): any;
    syntax_tree(): SyntaxTree;
}

export class SyntaxTree {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    copy(): SyntaxTree;
    data(): any;
}

export class Tokenization {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    copy(): Tokenization;
    text(): string;
    tokens(): any;
}

export class Utf16IndexMap {
    free(): void;
    [Symbol.dispose](): void;
    copy(): Utf16IndexMap;
    get_index(index: number): number;
    constructor(text: string);
}

export class WikitextSettings {
    free(): void;
    [Symbol.dispose](): void;
    copy(): WikitextSettings;
    static from_mode(mode: string, layout: string): WikitextSettings;
    constructor(settings: any);
}

export function parse(tokens: Tokenization, page_info: PageInfo, settings: WikitextSettings): ParseOutcome;

export function preprocess(text: string): string;

export function render_html(syntax_tree: SyntaxTree, page_info: PageInfo, settings: WikitextSettings): HtmlOutput;

export function render_text(syntax_tree: SyntaxTree, page_info: PageInfo, settings: WikitextSettings): string;

export function tokenize(text: string): Tokenization;

export function version(): string;
