/*
@jnode/xml

Simple XML package for Node.js.

by JustApple
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
    // options.cleanUp ??= true; // trim and remove double white-spaces in text content automatically
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
            if (i < xml.length && checkChar(regex)) i++;
            else break;
        }
        return i - begin;
    }

    // move i to next non-space character
    function skipSpaces() {
        return skipTill(SPACE_REGEX);
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
        return collectTill(NAME_END_REGEX);
    }

    // collect attribute name
    function collectAttributeName() {
        return collectTill(ATTRIBUTE_NAME_END_REGEX);
    }

    // collect string
    function collectString() {
        return collectTill(STRING_END_REGEX);
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

    // push self-closing or text elements without closing anything
    function pushElement(element) {
        if (openedElements.length > 0) {
            openedElements[openedElements.length - 1].content.push(element);
        } else {
            rootElement.content.push(element);
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
                            const clone = structuredClone(element);
                            clone.content = [];
                            clones.unshift(clone);

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
                skipTill(TAG_END_REGEX);
                continue;
            } else { // view as text
                i--;
            }
        }

        // collect text
        const text = collectTill(TEXT_END_REGEX);
        pushElement(text);
    }

    // close all elements
    for (let j = openedElements.length - 1; j >= 0; j--) {
        pushElement(openedElements.pop());
    }

    return rootElement;
}

const EXAMPLE_XML = `

`;
console.log(JSON.stringify(parse(EXAMPLE_XML), null, 3));