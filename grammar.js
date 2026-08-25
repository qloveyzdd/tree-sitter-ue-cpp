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
    preproc_include: $ => seq(
      uePreprocessor('include'),
      field('path', choice(
        $.ue_generated_header_path,
        $.ue_inline_generated_cpp_path,
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token.immediate(/\r?\n/),
    ),

    ue_generated_header_path: _ => token(prec(2, seq(
      '"',
      /[^"\n]*\.generated\.h/,
      '"',
    ))),

    ue_inline_generated_cpp_path: $ => seq(
      'UE_INLINE_GENERATED_CPP_BY_NAME',
      '(',
      field('name', $.identifier),
      ')',
    ),

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

    parameter_declaration: ($, original) => seq(
      repeat(choice($.ue_parameter_macro, $.ue_parameter_modifier)),
      original,
    ),

    optional_parameter_declaration: ($, original) => seq(
      repeat(choice($.ue_parameter_macro, $.ue_parameter_modifier)),
      original,
    ),

    variadic_parameter_declaration: ($, original) => seq(
      repeat(choice($.ue_parameter_macro, $.ue_parameter_modifier)),
      original,
    ),

    pure_virtual_clause: ($, original) => choice(
      original,
      $.ue_macro_invocation,
    ),

    ue_api_macro: _ => token(prec(2, /[A-Z][A-Z0-9_]*_API/)),

    ue_parameter_macro: $ => seq(
      'UPARAM',
      field('arguments', $.ue_macro_parenthesized_group),
    ),

    // These UE macros expand away before C++ compilation. Model them only in
    // parameter-declaration position so ordinary call arguments named OUT are
    // left to the base C++ grammar.
    ue_parameter_modifier: _ => token(prec(2, choice('IN', 'OUT', 'INOUT'))),

    ue_macro_invocation: $ => prec.right(seq(
      field('head', $.ue_macro_head),
      field('arguments', $.ue_macro_argument_tail),
      optional(';'),
    )),

    // Keep the opening parenthesis in the token so an ordinary UE type such
    // as FChangedEvent cannot be partially lexed as the one-letter macro F.
    ue_macro_head: _ => token(prec(2, /[A-Z][A-Z0-9]*(?:_[A-Za-z0-9_]+)*\s*\(/)),

    // UE declaration macros accept token sequences that are not always C++
    // expressions (for example, "int32 Value"). Keep each argument opaque,
    // but expose top-level argument boundaries and balance nested delimiters.
    ue_macro_argument_tail: $ => seq(
      optional(field('argument', $.ue_macro_argument)),
      repeat(seq(',', optional(field('argument', $.ue_macro_argument)))),
      ')',
    ),

    ue_macro_argument: $ => repeat1(choice(
      $.ue_macro_parenthesized_group,
      $.ue_macro_bracketed_group,
      $.ue_macro_braced_group,
      $.ue_macro_angle_group,
      $.string_literal,
      $.char_literal,
      $.raw_string_literal,
      $.ue_macro_argument_fragment,
    )),

    ue_macro_parenthesized_group: $ => seq(
      '(',
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.ue_macro_bracketed_group,
        $.ue_macro_braced_group,
        $.ue_macro_angle_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
        ',',
      )),
      ')',
    ),

    ue_macro_bracketed_group: $ => seq(
      '[',
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.ue_macro_bracketed_group,
        $.ue_macro_braced_group,
        $.ue_macro_angle_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
        ',',
      )),
      ']',
    ),

    ue_macro_braced_group: $ => seq(
      '{',
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.ue_macro_bracketed_group,
        $.ue_macro_braced_group,
        $.ue_macro_angle_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
        ',',
      )),
      '}',
    ),

    ue_macro_angle_group: $ => seq(
      '<',
      repeat(choice(
        $.ue_macro_parenthesized_group,
        $.ue_macro_bracketed_group,
        $.ue_macro_braced_group,
        $.ue_macro_angle_group,
        $.string_literal,
        $.char_literal,
        $.raw_string_literal,
        $.ue_macro_argument_fragment,
        ',',
      )),
      '>',
    ),

    ue_macro_argument_fragment: _ => token(prec(-1, /[^,(){}<>\[\]"']+/)),
  },
});

function uePreprocessor(command) {
  return alias(new RegExp('#[ \\t]*' + command), '#' + command);
}
