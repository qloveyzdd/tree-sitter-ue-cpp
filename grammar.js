/**
 * @file Unreal Engine-flavoured C++ grammar for tree-sitter
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const CPP = require('tree-sitter-cpp/grammar');

module.exports = grammar(CPP, {
  name: 'ue_cpp',

  rules: {
    _top_level_item: ($, original) => choice(
      original,
      $.ue_macro_invocation,
    ),

    _field_declaration_list_item: ($, original) => choice(
      original,
      $.ue_macro_invocation,
    ),

    declaration_list: $ => seq(
      '{',
      repeat(choice($._block_item, $.ue_macro_invocation)),
      '}',
    ),

    _class_declaration: ($, original) => choice(
      original,
      seq($.ue_api_macro, original),
    ),

    _declaration_modifiers: ($, original) => choice(
      original,
      $.ue_api_macro,
    ),

    ue_api_macro: _ => token(prec(2, /[A-Z][A-Z0-9_]*_API/)),

    ue_macro_invocation: $ => prec.right(seq(
      field('head', $.ue_macro_head),
      field('arguments', $.ue_macro_argument_tail),
      optional(';'),
    )),

    // Keep the opening parenthesis in the token so an ordinary UE type such
    // as FChangedEvent cannot be partially lexed as the one-letter macro F.
    ue_macro_head: _ => token(prec(2, /[A-Z][A-Z0-9]*(?:_[A-Za-z0-9_]+)*\s*\(/)),

    // UE declaration macros accept token sequences that are not always C++
    // expressions (for example, "int32 Value"). Keep their contents opaque
    // while balancing nested parentheses and preserving the original span.
    ue_macro_argument_tail: $ => seq(
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
      )),
      ')',
    ),

    ue_macro_parenthesized_group: $ => seq(
      '(',
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
      )),
      ')',
    ),

    ue_macro_argument_fragment: _ => token(prec(-1, /[^()"']+/)),
  },
});
