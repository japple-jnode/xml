/*
@jnode/xml

Simple XML package for Node.js.

by JustApple - main logic and code
      Gemini - performance analysis and suggestions
*/

// some regexps
export const SPACE_REGEX = /\s/yu;
export const NAME_REGEX = /[\p{L}_:]/yu;
export const NAME_END_REGEX = /[\s/>]/yu;
export const ATTRIBUTE_NAME_END_REGEX = /[\s=/>]/yu;
export const STRING_END_REGEX = /"/yu;
export const ATTRIBUTE_VALUE_END_REGEX = /[\s>]/yu;
export const COMMENT_REGEX = /[?!]/yu;
export const TAG_END_REGEX = />/yu;
export const TEXT_END_REGEX = /</yu

// html void elements
export const HTML_VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// parse XML or HTML
export function parse(xml = '', options = {}) {
    // verify input xml type
    if (typeof xml !== 'string') throw new TypeError('xml must be a String.');

    // config options
    // options.strict ??= true; // disable auto closing and more
    options.trim ??= true; // trim text content automatically
    options.voidElements = Array.isArray(options.voidElements) ? new Set(options.voidElements) : options.voidElements; // void elements will close automatically

    // variables
    const rootElement = { name: null, attributes: {}, content: [] };
    const openedElements = [];
    let i = 0;

    // check char with regex
    function checkChar(regex) {
        regex.lastIndex = i;
        return regex.test(xml);
    }

    // skip string until
    function skipTill(regex) {
        const begin = i;
        while (true) {
            if (i >= xml.length || checkChar(regex)) break;
            else i++;
        }
        return i - begin;
    }

    // skip string in
    function skipIn(regex) {
        const begin = i;
        while (true) {
            if (i < xml.length && checkChar(regex)) i++;
            else break;
        }
        return i - begin;
    }

    // move i to next non-space character
    function skipSpaces() {
        while (i < xml.length && xml.charCodeAt(i) <= 32) i++;
    }

    // collect string until
    function collectTill(regex) {
        const begin = i;
        while (true) {
            if (i >= xml.length || checkChar(regex)) break;
            else i++;
        }
        return xml.slice(begin, i);
    }

    // collect element name
    function collectName() {
        const begin = i;
        while (i < xml.length) {
            const code = xml.charCodeAt(i);
            if (code <= 32 || code === 47 || code === 62) break; // spaces, `/` and `>`
            i++;
        }
        return xml.slice(begin, i);
    }

    // collect attribute name
    function collectAttributeName() {
        const begin = i;
        while (i < xml.length) {
            const code = xml.charCodeAt(i);
            if (code <= 32 || code === 61 || code === 47 || code === 62) break; // spaces, `=`, `/` and `>`
            i++;
        }
        return xml.slice(begin, i);
    }

    // collect string
    function collectString() {
        const begin = i;
        const nextQuote = xml.indexOf('"', i);
        if (nextQuote === -1) {
            i = xml.length;
            return xml.slice(begin);
        }
        i = nextQuote;
        return xml.slice(begin, nextQuote);
    }

    // collect attribute value
    function collectAttributeValue() {
        return collectTill(ATTRIBUTE_VALUE_END_REGEX);
    }

    // collect attributes
    function collectAttributes() {
        const attributes = {};

        // multi attributes will become an array
        function pushAttribute(name, value) {
            if (Array.isArray(attributes[name])) attributes[name].push(value);
            else if (attributes[name]) attributes[name] = [attributes[name], value];
            else attributes[name] = value;
        }

        while (true) {
            skipSpaces();
            // check if ends
            if (xml[i] === '/') { // self closing element
                if (xml[i + 1] === '>') break;
                else { i++; continue; }
            }
            else if (xml[i] === '>') break; // tag ends
            else if (i >= xml.length) break; // xml ends

            // get name
            const name = collectAttributeName();

            skipSpaces();
            if (xml[i] === '=') { // with string value
                i++;
                if (xml[i] === '"') { // wrapped string
                    i++;
                    const value = collectString();
                    pushAttribute(name, value);
                    i++;
                } else {
                    const value = collectAttributeName();
                    pushAttribute(name, value);
                }
            } else { // boolean value
                pushAttribute(name, true);
            }
        }

        return attributes;
    }

    // collect text
    function collectText() {
        const begin = i;
        const nextBracket = xml.indexOf('<', i);
        if (nextBracket === -1) {
            i = xml.length;
            return xml.slice(begin);
        }
        i = nextBracket;
        return xml.slice(begin, nextBracket);
    }

    // push self-closing or text elements without closing anything
    function pushElement(element) {
        if (options.trim && typeof element == 'string') {
            element = element.trim();
            if (!element) return;
        }

        if (openedElements.length > 0) {
            const content = openedElements[openedElements.length - 1].content;

            if (typeof element === 'string' && typeof content[content.length - 1] === 'string') { // merge string
                content[content.length - 1] += element;
            } else content.push(element);
        } else {
            const content = rootElement.content;

            if (typeof element === 'string' && typeof content[content.length - 1] === 'string') { // merge string
                content[content.length - 1] += element;
            } else content.push(element);
        }
    }

    // main loop
    while (i < xml.length) {
        // note:
        //   every time of the loop will result in one of the following changes:
        //     1. a new element (collected a opening tag)
        //     2. a new text content (collected until opening or closing tag)
        //     3. close one or more element (collected a closing tag)

        // check tag
        if (xml[i] === '<') {
            i++;

            if (xml[i] == '/') { // closing tag
                i++;
                if (checkChar(NAME_REGEX)) {
                    const name = collectName();
                    collectAttributes(); // just for cleaning, closing tag doesn't have attributes

                    // skip tag end
                    if (xml[i] === '/') i += 2;
                    else if (xml[i] === '>') i++;

                    // find matched element in opened elements
                    const matchedId = openedElements.findIndex((e) => e.name === name);
                    if (matchedId === -1) continue; // no match, ignore

                    // close, push and clone the elements
                    const clones = [];
                    for (let j = openedElements.length - 1; j >= 0; j--) {
                        const element = openedElements.pop();

                        if (element.name === name) { // matched element
                            pushElement(element);
                            break;
                        } else { // elements after it
                            // clone
                            clones.unshift({
                                name: element.name,
                                attributes: element.attributes,
                                content: []
                            });

                            // push
                            pushElement(element);
                        }
                    }

                    // push back clones
                    openedElements.push(...clones);

                    continue;
                } else { // view as comment
                    skipTill(TAG_END_REGEX);
                    continue;
                }
            } else if (checkChar(NAME_REGEX)) { // opening tag
                const name = collectName();
                const attributes = collectAttributes();

                // skip tag end
                if (xml[i] === '/' || options?.voidElements?.has(name)) { // self closing tag
                    i += 2;

                    // push element
                    pushElement({ name, attributes, content: null });

                    continue;
                } else if (xml[i] === '>') {
                    i++;
                }

                // create element
                openedElements.push({ name, attributes, content: [] });

                continue;
            } else if (checkChar(COMMENT_REGEX)) { // comments, include bogus comments
                skipTill(TAG_END_REGEX); i++;
                continue;
            } else { // view as text
                pushElement(xml[i - 1]);
            }
        }

        // collect text
        pushElement(collectText());
    }

    // close all elements
    for (let j = openedElements.length - 1; j >= 0; j--) {
        pushElement(openedElements.pop());
    }

    return rootElement;
}