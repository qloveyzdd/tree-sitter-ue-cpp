/**
 * @file Unreal Engine-flavoured C++ grammar for tree-sitter
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const CPP = require('tree-sitter-cpp/grammar');

module.exports = grammar(CPP, {
  name: 'ue_cpp',

  conflicts: ($, original) => original.concat([
    [$.argument_list, $.ue_out_argument_list],
  ]),

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
      $.ue_gameplay_tag_macro,
      $.ue_exported_macro_invocation,
      $.ue_macro_invocation,
    ),

    _field_declaration_list_item: ($, original) => choice(
      original,
      $.ue_exported_macro_invocation,
      $.ue_macro_invocation,
    ),

    _block_item: ($, original) => choice(
      original,
      $.ue_statement_macro,
      $.ue_macro_invocation,
    ),

    declaration_list: $ => seq(
      '{',
      repeat(choice(
        $._block_item,
        $.ue_gameplay_tag_macro,
      )),
      '}',
    ),

    _class_declaration: ($, original) => choice(
      original,
      seq($.ue_api_macro, original),
    ),

    _declaration_modifiers: ($, original) => choice(
      original,
      $.ue_api_macro,
      $.ue_declaration_modifier,
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

    enumerator: ($, original) => seq(
      original,
      optional($.ue_macro_invocation),
    ),

    _string: ($, original) => choice(
      original,
      $.ue_text_literal_sequence,
    ),

    call_expression: ($, original) => choice(
      original,
      prec(15, seq(
        field('function', $.expression),
        field('arguments', $.ue_out_argument_list),
      )),
    ),

    // OUT is legal both as a parameter annotation and as a no-op marker before
    // selected call arguments. Keep the call-site extension isolated from the
    // base argument_list so unrelated C++ expressions retain their precedence.
    ue_out_argument_list: $ => {
      const argument = choice($.expression, $.initializer_list, $.compound_statement);
      return seq(
        '(',
        repeat(seq(argument, ',')),
        $.ue_out_argument,
        repeat(seq(',', argument)),
        ')',
      );
    },

    ue_out_argument: $ => seq(
      field('modifier', alias('OUT', $.ue_parameter_modifier)),
      field('argument', $.expression),
    ),

    ue_text_literal_sequence: _ => token(prec(3,
      /TEXT\s*\(\s*"(?:\\.|[^"\\])*"\s*\)(?:\s*TEXT\s*\(\s*"(?:\\.|[^"\\])*"\s*\))+/
    )),

    field_expression: ($, original) => choice(
      original,
      seq(
        prec(16, seq(
          field('argument', $.expression),
          field('operator', '->*'),
        )),
        field('field', $._field_identifier),
      ),
    ),

    if_statement: ($, original) => choice(
      original,
      prec.right(seq(
        'if',
        optional('constexpr'),
        field('condition', $.condition_clause),
        field('pragma', $.ue_statement_macro),
        field('consequence', $.statement),
        optional(field('alternative', $.else_clause)),
      )),
    ),

    ue_api_macro: _ => token(prec(2, /[A-Z][A-Z0-9_]*_API/)),

    ue_declaration_modifier: _ => token(prec(2, choice(
      'FORCEINLINE',
      'FORCEINLINE_DEBUGGABLE',
      'FORCENOINLINE',
    ))),

    ue_statement_macro: _ => token(prec(2, /PRAGMA_[A-Z0-9_]+/)),

    ue_parameter_macro: $ => seq(
      'UPARAM',
      field('arguments', $.ue_macro_parenthesized_group),
    ),

    // These UE macros expand away before C++ compilation. Model them only in
    // parameter-declaration position so ordinary call arguments named OUT are
    // left to the base C++ grammar.
    ue_parameter_modifier: _ => token(prec(2, choice('IN', 'OUT', 'INOUT'))),

    ue_gameplay_tag_macro: $ => prec.right(3, seq(
      optional(field('api', $.ue_api_macro)),
      field('head', $.ue_gameplay_tag_macro_head),
      field('arguments', $.ue_macro_argument_tail),
      optional(';'),
    )),

    ue_gameplay_tag_macro_head: _ => token(prec(3, choice(
      /UE_DECLARE_GAMEPLAY_TAG_EXTERN\s*\(/,
      /UE_DEFINE_GAMEPLAY_TAG_COMMENT\s*\(/,
      /UE_DEFINE_GAMEPLAY_TAG_STATIC\s*\(/,
      /UE_DEFINE_GAMEPLAY_TAG\s*\(/,
    ))),

    ue_macro_invocation: $ => prec.right(seq(
      field('head', $.ue_macro_head),
      field('arguments', $.ue_macro_argument_tail),
      optional(';'),
    )),

    ue_exported_macro_invocation: $ => seq(
      field('api', $.ue_api_macro),
      field('invocation', $.ue_macro_invocation),
    ),

    // Keep this restricted to declaration-style macro families. A generic
    // all-caps matcher also captures Slate pseudo constructors and UE class
    // constructors, which can make one macro node consume the following body.
    ue_macro_head: _ => token(prec(2, /(?:UCLASS|USTRUCT|UENUM|UINTERFACE|UPROPERTY|UFUNCTION|UMETA|ATTRIBUTE_ACCESSORS|CSV_DEFINE_CATEGORY|ENUM_RANGE_BY_COUNT|PURE_VIRTUAL|ENSURE_[A-Za-z0-9_]+|(?:DECLARE|DEFINE|IMPLEMENT|GENERATED)[A-Z0-9]*(?:_[A-Za-z0-9_]+)*|UE_NET_[A-Za-z0-9_]+)\s*\(/)),

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
