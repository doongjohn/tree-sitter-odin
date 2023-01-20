// WIP:
// - range expression
// - bit_set

// TODO:
// - do
// - or_else
// - or_return
// - type / proc with generic parameter
// - where clause https://odin-lang.org/docs/overview/#where-clauses
// - directives https://odin-lang.org/docs/overview/#directives

// NOTE: ok... this works...
/*
  test :: proc() -> int {
    return \
      10
  }
*/

// - test: literals
// - test: statements
// - test: expressions
// - test: declarations
// - test: assignments

const
  PREC = {
    primary: 7,
    unary: 6,
    multiplicative: 5,
    additive: 4,
    comparative: 3,
    and: 2,
    or: 1,
    composite_literal: -1,
  },

  // https://odin-lang.org/docs/overview/#operator-precedence
  multiplicative_operators = ['*', '/', '%', '%%', '<<', '>>', '&', '&~'],
  additive_operators = ['+', '-', '|', '~', 'in', 'not_in'],
  comparative_operators = ['==', '!=', '<', '<=', '>', '>='],

  unicodeLetter = /\p{L}/,
  unicodeDigit = /[0-9]/,
  unicodeChar = /./,
  letter = choice(unicodeLetter, '_'),

  newline = '\n',
  terminator = choice(newline, ';'),

  hexDigit = /[0-9a-fA-F]/,
  octalDigit = /[0-7]/,
  decimalDigit = /[0-9]/,
  binaryDigit = /[01]/,

  hexDigits = seq(hexDigit, repeat(seq(optional('_'), hexDigit))),
  octalDigits = seq(octalDigit, repeat(seq(optional('_'), octalDigit))),
  decimalDigits = seq(decimalDigit, repeat(seq(optional('_'), decimalDigit))),
  binaryDigits = seq(binaryDigit, repeat(seq(optional('_'), binaryDigit))),

  hexLiteral = seq('0', choice('x', 'X'), optional('_'), hexDigits),
  octalLiteral = seq('0', optional(choice('o', 'O')), optional('_'), octalDigits),
  decimalLiteral = choice('0', seq(/[1-9]/, optional(seq(optional('_'), decimalDigits)))),
  binaryLiteral = seq('0', choice('b', 'B'), optional('_'), binaryDigits),
  intLiteral = choice(binaryLiteral, decimalLiteral, octalLiteral, hexLiteral),

  decimalExponent = seq(choice('e', 'E'), optional(choice('+', '-')), decimalDigits),
  decimalFloatLiteral = choice(
    seq(decimalDigits, '.', optional(decimalDigits), optional(decimalExponent)),
    seq(decimalDigits, decimalExponent),
    seq('.', decimalDigits, optional(decimalExponent)),
  ),
  floatLiteral = decimalFloatLiteral,

  builtin_types = [
    'byte',
    'bool', 'b8', 'b16', 'b32', 'b64',
    'u8', 'u16', 'u32', 'u64', 'u128',
    'i8', 'i16', 'i32', 'i64', 'i128',
    'f16', 'f32', 'f64',
    'f16le', 'f32le', 'f64le',
    'f16be', 'f32be', 'f64be',
    'u16le', 'u32le', 'u64le', 'u128le',
    'i16le', 'i32le', 'i64le', 'i128le',
    'u16be', 'u32be', 'u64be', 'u128be',
    'i16be', 'i32be', 'i64be', 'i128be',
    'string', 'cstring', 'rune',
    'map',
    'matrix',
    'complex32', 'complex64', 'complex128',
    'quaternion64', 'quaternion128', 'quaternion256',
    'uintptr', 'uint', 'int',
    'rawptr',
    'typeid',
    'any'
  ],

  builtin_procs = [
    'len',
    'swizzle',
    'new', 'free',
    'make', 'delete',
    'size_of', 'align_of',
    'soa_zip', 'soa_unzip',
    'typeid_of', 'type_info_of',
    '#config', '#defined',
    '#assert', '#panic',
    '#location',
    '#file', '#line', '#procedure',
    '#load', '#load_or', '#load_hash'
  ]

module.exports = grammar({
  name: 'odin',

  extras: $ => [
    $.comment,
    /\s/
  ],

  conflicts: $ => [
    [$.using_statement, $.identifier_list],
    [$._identifier_deref_list, $.identifier_list],
    [$.proc_definition , $.type_proc],
    [$._expression, $._type],
  ],

  rules: {
    source_file: $ => repeat(
      seq($._file_scope, optional(terminator))
    ),

    _file_scope: $ => choice(
      $._declaration,
      $._statement,
      // TODO: when statement
      // TODO: foreign block
      // https://odin-lang.org/docs/overview/#foreign-system
    ),

    _declaration: $ => choice(
      $.package_clause,
      $.import_declaration,
      $.attribute_declaration,
      $.const_declaration,
      $.var_declaration,
    ),

    package_clause: $ => seq(
      alias('package', $.keyword),
      $._package_identifier,
    ),

    import_declaration: $ => seq(
      optional(alias('foreign', $.keyword)),
      alias('import', $.keyword),
      optional(field('name', choice(
        $.blank_identifier,
        $._package_identifier,
      ))),
      field('path', $._string_literal),
    ),

    blank_identifier: $ => '_',
    _package_identifier: $ => alias($.identifier, $.package_identifier),

    attribute_declaration: $ => seq(
      '@(',
      field('attribute', alias($.identifier, $.keyword)),
      optional(seq(
        alias('=', $.operator),
        field('value', choice(
          $._type,
          $._expression,
        ))
      )),
      ')'
    ),

    const_declaration: $ => seq(
      field('name', $.identifier_list),
      alias(':', $.operator),
      optional(field('type', $._type)),
      alias(':', $.operator),
      field('value', $.expression_list),
    ),

    var_declaration: $ => seq(
      field('name', $.identifier_list),
      alias(':', $.operator),
      choice(
        field('type', $._type),
        seq(
          optional(field('type', $._type)),
          alias('=', $.operator),
          field('value', $.expression_list)
        )
      )
    ),

    _statement: $ => choice(
      $.assignment_statement,
      $.block_statement,
      $.using_statement,
      $.return_statement,
      // TODO: other statements
      //   - for
      //     - Basic for loop
      //     - Range-based for loop
      //   - if
      //   - switch
      //   - defer
      //   - when
      //   - break, continue, fallthrough
      //   - proc group https://odin-lang.org/docs/overview/#explicit-procedure-overloading
    ),

    assignment_statement: $ => seq(
      field('name', alias($._identifier_deref_list, $.identifier_list)),
      alias('=', $.operator),
      field('value', $.expression_list),
    ),

    block_statement: $ => seq(
      '{',
      optional(seq(
        choice(
          $.attribute_declaration,
          $.const_declaration,
          $.var_declaration,
          $._statement,
          $._expression,
        ),
        optional(terminator)
      )),
      '}',
    ),

    using_statement: $ => seq(
      alias('using', $.keyword),
      $._expression,
    ),

    return_statement: $ => prec.right(1, seq(
      alias('return', $.keyword),
      optional($.expression_list),
    )),

    identifier_list: $ => commaSep1(seq(
      optional(alias('using', $.operator)),
      $.identifier,
    )),
    _identifier_deref_list: $ => commaSep1(choice(
      $.identifier,
      $.dereference_expression,
    )),
    expression_list: $ => commaSep1(choice(
      $._expression,
      $._type,
    )),

    _literal: $ => choice(
      $._string_literal,
      $._numeric_literal,
      // TODO: other literals
      // array_literal [5]int{1, 2, 3, 4, 5}, Vector3{1, 4, 9}
      // struct_literal Vector2{1, 2}, Vector2{}
      // union literal
      // proc literal
      $.nil,
      $.true,
      $.false,
      $.undefined_value,
    ),

    _string_literal: $ => choice(
      $.raw_string_literal,
      $.interpreted_string_literal,
    ),
    raw_string_literal: $ => token(seq(
      '`',
      repeat(/[^`]/),
      '`',
    )),
    interpreted_string_literal: $ => seq(
      '"',
      repeat(choice(
        $._interpreted_string_literal_basic_content,
        $.escape_sequence,
      )),
      '"',
    ),
    _interpreted_string_literal_basic_content: $ =>
      token.immediate(prec(1, /[^"\n\\]+/)),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{2,}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/
      )
    )),

    _numeric_literal: $ => choice(
      $.int_literal,
      $.float_literal,
    ),
    int_literal: $ => token(intLiteral),
    float_literal: $ => token(floatLiteral),

    nil: $ => 'nil',
    true: $ => 'true',
    false: $ => 'false',
    undefined_value: $ => alias('---', $.keyword),
    context_variable: $ => alias('context', $.keyword),

    _expression: $ => choice(
      $._literal,
      $.identifier,
      $.dereference_expression,
      $.selector_expression,
      $.implicit_selector_expression,
      $.binary_expression,
      $.parenthesized_expression,
      $.call_expression,
      $.type_conversion_expression,
      $.proc_definition,
      $.context_variable,
      // TODO: other expressions
      //   - ternary expressions
      //   - unary expressions
      //   - expressions with prefix operator
      //     'cast',
      //     'auto_cast',
      //     'transmute',
      //     'distinct',
    ),

    identifier: $ => token(seq(
      letter,
      repeat(choice(letter, unicodeDigit))
    )),

    dereference_expression: $ => seq(
      $.identifier,
      alias('^', $.operator),
    ),

    selector_expression: $ => seq(
      field('operand', $._expression),
      '.',
      field('field', $.identifier),
    ),

    implicit_selector_expression: $ => seq(
      '.',
      field('field', $.identifier),
    ),

    binary_expression: $ => {
      const table = [
        [PREC.multiplicative, choice(...multiplicative_operators)],
        [PREC.additive, choice(...additive_operators)],
        [PREC.comparative, choice(...comparative_operators)],
        [PREC.and, '&&'],
        [PREC.or, '||'],
      ];

      return choice(...table.map(([precedence, operator]) =>
        prec.left(precedence, seq(
          field('left', $._expression),
          field('operator', operator),
          field('right', $._expression)
        ))
      ));
    },

    // TODO: make this
    range_expression: $ => seq(

      alias(
        choice('..', '..=', '..<'),
        $.operator
      ),

    ),

    parenthesized_expression: $ => seq(
      '(', $._expression, ')'
    ),

    proc_definition: $ => seq(
      alias('proc', $.keyword),
      field('parameters', $.parameters),
      optional(seq(
        alias('->', $.operator),
        field('result', $.proc_result)
      )),
      field('body', choice(
        $.block_statement,
        $.undefined_value,
      ))
    ),
    parameters: $ => seq(
      '(', commaSep($.parameter_declaration), ')',
    ),
    parameter_declaration: $ => choice(
      // NOTE: is this impossible to parse?
      /*
        p :: proc(TypeName, b: f32) {}
      */
      // TODO: variadic parameter
      prec.dynamic(0, $._named_parameter_declaration),
      prec.dynamic(1, $._unnamed_parameter_declaration),
    ),
    _named_parameter_declaration: $ => prec.right(1, seq(
      commaSep1(seq(
        field('using', optional(alias('using', $.keyword))),
        optional(alias('$', $.operator)), // compile-time parameter
        field('name', $.identifier),
      )),
      alias(':', $.operator),
      optional(alias('$', $.operator)), // generic type
      field('type', $._type),
      // TODO: generic constraint
      // https://odin-lang.org/docs/overview/#specialization
      optional(seq(
        alias('=', $.operator),
        $._expression
      ))
    )),
    _unnamed_parameter_declaration: $ => seq(
      field('type', $._type),
    ),

    proc_result_declaration: $ => choice(
      prec.dynamic(0, $._named_parameter_declaration),
      prec.dynamic(1, $._unnamed_parameter_declaration),
    ),
    proc_result: $ => choice(
      $._type,
      seq('(', commaSep($.proc_result_declaration), ')')
    ),

    call_expression: $ => choice(
      prec(1, $._builtin_call_expression),
      prec(0, $._normal_call_expression),
    ),
    _normal_call_expression: $ => seq(
      field('function_call', $._expression),
      field('arguments', $.arguments),
    ),
    // FIXME: this is not working if another expression is after this call
    _builtin_call_expression: $ => seq(
      field(
        'function_call',
        alias(token(choice(...builtin_procs)), $.builtin_procedure),
      ),
      field('arguments', $.arguments),
    ),

    arguments: $ => seq(
      '(',
      commaSep(choice($.argument, $.named_argument)),
      ')',
    ),
    argument: $ => seq(
      field('value', choice(
        $._known_type,
        $._expression,
      ))
    ),
    named_argument: $ => seq(
      field('name', $.identifier),
      alias('=', $.operator),
      field('value', choice(
        $._known_type,
        $._expression,
      ))
    ),

    type_conversion_expression: $ => seq(
      $._type, '(', $._expression, ')'
    ),

    _known_type: $ => choice(
      alias(choice(...builtin_types), $.type_identifier),
      $.type_of_expression,
      $.type_pointer,
      $.type_multi_pointer,
      $.type_slice,
      $.type_fixed_array,
      $.type_dynamic_array,
      $.type_soa_slice,
      $.type_soa_fixed_array,
      $.type_soa_dynamic_array,
      $.type_proc,
      $._type_value,
    ),
    _type: $ => choice(
      $._known_type,
      alias($.identifier, $.type_identifier),
    ),

    type_of_expression: $ => seq(
      alias('type_of', $.builtin_identifier),
      '(', $._expression, ')',
    ),

    type_pointer: $ => seq(
      alias('^', $.operator),
      $._type,
    ),
    type_multi_pointer: $ => seq(
      '[', alias('^', $.operator), ']',
      $._type,
    ),

    type_slice: $ => seq(
      '[]',
      $._type,
    ),
    type_fixed_array: $ => seq(
      '[', $._expression, ']',
      $._type,
    ),
    type_dynamic_array: $ => seq(
      '[', alias('dynamic', $.keyword), ']',
      $._type,
    ),

    type_soa_slice: $ => seq(
      alias('#soa', $.keyword),
      $.type_slice,
    ),
    type_soa_fixed_array: $ => seq(
      alias('#soa', $.keyword),
      $.type_fixed_array,
    ),
    type_soa_dynamic_array: $ => seq(
      alias('#soa', $.keyword),
      $.type_dynamic_array,
    ),

    type_proc: $ => seq(
      alias('proc', $.keyword),
      field('parameters', $.parameters),
      optional(seq(
        alias('->', $.operator),
        field('result', $.proc_result)
      )),
    ),

    _type_value: $ => choice(
      $.type_value_struct,
      $.type_value_union,
      $.type_value_enum,
    ),
    type_value_tag: $ => seq(
      '#',
      $.identifier,
      optional($._expression)
    ),

    type_value_struct: $ => seq(
      alias('struct', $.keyword),
      optional(field('tag', $.type_value_tag)),
      '{',
      optional(commaSep(field('field', $.type_value_struct_field))),
      optional(','),
      '}'
    ),
    type_value_struct_field: $ => seq(
      field('name', $.identifier_list),
      alias(':', $.operator),
      field('type', $._type),
    ),

    type_value_union: $ => seq(
      alias('union', $.keyword),
      optional(field('tag', $.type_value_tag)),
      '{',
      optional(commaSep(field('field', $.type_value_union_field))),
      optional(','),
      '}'
    ),
    type_value_union_field: $ => seq(
      $._type,
    ),

    type_value_enum: $ => seq(
      alias('enum', $.keyword),
      optional(field('type', $._type)),
      optional(field('tag', $.type_value_tag)),
      '{',
      optional(commaSep(field('field', $.type_value_enum_field))),
      optional(','),
      '}'
    ),
    type_value_enum_field: $ => seq(
      alias($.identifier, $.enum_field),
      optional(seq(
        alias('=', $.operator),
        $._expression
      ))
    ),

    comment: $ => token(choice(
      seq('//', /.*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/'
      )
    )),
  }
})

function commaSep(rule) {
  return optional(commaSep1(rule))
}
function commaSep1(rule) {
  return seq(
    rule,
    repeat(seq(
      ',',
      rule
    ))
  )
}

function commaTerminated(rule) {
  return optional(commaTerminated1(rule))
}
function commaTerminated1(rule) {
  return seq(
    rule,
    ',',
    repeat(seq(
      rule,
      ',',
    ))
  )
}
