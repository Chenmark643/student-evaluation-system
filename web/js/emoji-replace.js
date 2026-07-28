/**
 * Emoji → Apple Emoji PNG replacement
 * Intercepts innerHTML assignments to replace emoji chars with <img> tags.
 * Works universally across all dynamically generated content.
 */
(function() {
  'use strict';

  var EMOJI_DIR = 'assets/emoji/';

  // Map every emoji codepoint to its PNG path
  function emojiToImg(ch) {
    var cp = ch.codePointAt(0);
    var hex = cp.toString(16).toLowerCase();
    return '<img src="' + EMOJI_DIR + hex + '.png" class="emoji-img" alt="' + ch + '">';
  }

  // Characters we have SVG fallbacks for (not in Apple set)
  var SVG_FALLBACK = {
    '➕': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    '☆': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>',
    '☐': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    '✓': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    '✗': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    'Σ': '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 4H6l6 8-6 8h12"/></svg>'
  };

  function isEmoji(cp) {
    return (cp >= 0x1F000 && cp <= 0x1FFFF) ||
           (cp >= 0x2600 && cp <= 0x27BF) ||
           (cp >= 0x2300 && cp <= 0x23FF && cp !== 0x23F0 && cp !== 0x23F3) ||
           (cp >= 0x2B00 && cp <= 0x2BFF) ||
           (cp >= 0x2702 && cp <= 0x27B0) ||
           SVG_FALLBACK[String.fromCodePoint(cp)] !== undefined;
  }

  function replaceEmojisInString(str) {
    if (!str || str.indexOf('\u{1F}') < 0 && str.indexOf('\u{26}') < 0 && str.indexOf('\u{27}') < 0 && str.indexOf('\u{2B}') < 0 && str.indexOf('\u{23}') < 0) {
      // Quick check: no likely emoji range characters
      var hasEmoji = false;
      for (var i = 0; i < str.length; i++) {
        if (isEmoji(str.codePointAt(i))) { hasEmoji = true; break; }
      }
      if (!hasEmoji) return str;
    }

    var result = '';
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
      if (isEmoji(cp)) {
        var ch = String.fromCodePoint(cp);
        if (SVG_FALLBACK[ch]) {
          result += SVG_FALLBACK[ch];
        } else {
          var hex = cp.toString(16).toLowerCase();
          result += '<img src="' + EMOJI_DIR + hex + '.png" class="emoji-img" alt="' + ch + '">';
        }
        if (cp > 0xFFFF) i++; // skip surrogate pair
      } else {
        result += str[i];
      }
    }
    return result;
  }

  // Monkey-patch innerHTML setter
  var origDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (origDescriptor && origDescriptor.set) {
    var origSet = origDescriptor.set;
    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function(value) {
        origSet.call(this, replaceEmojisInString(value));
      },
      get: origDescriptor.get,
      configurable: true, enumerable: true
    });
  }

  // Also patch insertAdjacentHTML which is used by some frameworks
  var origInsert = Element.prototype.insertAdjacentHTML;
  if (origInsert) {
    Element.prototype.insertAdjacentHTML = function(position, text) {
      return origInsert.call(this, position, replaceEmojisInString(text));
    };
  }

  // Patch document.write for completeness
  var origWrite = document.write;
  document.write = function() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(replaceEmojisInString(arguments[i]));
    }
    return origWrite.apply(document, args);
  };
})();
