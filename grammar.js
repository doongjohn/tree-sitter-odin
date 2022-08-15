// TODO:
// test all literals
// test all types
// add statement that includes operator
// add expression that includes operator

const
  unicodeLetter = /\p{L}/,
  unicodeDigit = /[0-9]/,
  unicodeChar = /./,
  unicodeValue = unicodeChar,
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
    'matrix',
    'complex32', 'complex64', 'complex128',
    'quaternion64', 'quaternion128', 'quaternion256',
    'uintptr', 'uint', 'int',
    'rawptr',
    'typeid',
    'any'
  ],

  operators = [
    'cast',
    'auto_cast',
    'transmute',
  ],

  builtin_procs = [
    'len',
    'swizzle',
    'new', 'free',
    'make', 'delete',
    'soa_zip', 'soa_unzip',
    'typeid_of', 'type_info_of',
    '#assert', '#panic',
    '#config',
    '#defined',
    '#file', '#line', '#procedure',
    '#location',
    '#load', '#load_or', '#load_hash'
  ]

module.exports = grammar({
  name: "odin",

  extras: $ => [
    $.comment,
    /\s/
  ],

  conflicts: $ => [
    [$._identifier_deref_list, $.identifier_list],
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
      ':',
      optional(field('type', $._type)),
      alias(':', $.operator),
      field('value', $.expression_list),
    ),

    var_declaration: $ => seq(
      field('name', $.identifier_list),
      ':',
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
      // TODO: other statements
      //   - for
      //   - if
      //   - switch
      //   - defer
      //   - when
      //   - break, continue, fallthrough
      //   - proc group
    ),

    assignment_statement: $ => seq(
      field('name', alias($._identifier_deref_list, $.identifier_list)),
      alias('=', $.operator),
      field('value', $.expression_list)
    ),

    block_statement: $ => seq(
      '{',
      seq(choice(
        $.attribute_declaration,
        $.const_declaration,
        $.var_declaration,
        $._statement,
        $._expression,
        optional(terminator)
      )),
      '}'
    ),

    _identifier_deref_list: $ => commaSep1(choice(
      $.identifier,
      $.dereference_expression
    )),
    identifier_list: $ => commaSep1($.identifier),
    expression_list: $ => commaSep1($._expression),

    _literal: $ => choice(
      $._string_literal,
      $._numeric_literal,
      // TODO: other literals
      // array_literal [5]int{1, 2, 3, 4, 5}, Vector3{1, 4, 9}
      // struct_literal Vector2{1, 2}, Vector2{}
      // proc literal
      // union literal
      $.nil,
      $.true,
      $.false,
    ),

    _string_literal: $ => choice(
      $.raw_string_literal,
      $.interpreted_string_literal
    ),
    raw_string_literal: $ => token(seq(
      '`',
      repeat(/[^`]/),
      '`'
    )),
    interpreted_string_literal: $ => seq(
      '"',
      repeat(choice(
        $._interpreted_string_literal_basic_content,
        $.escape_sequence
      )),
      '"'
    ),
    _interpreted_string_literal_basic_content: $ => token.immediate(prec(1, /[^"\n\\]+/)),

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
      $.float_literal
    ),
    int_literal: $ => token(intLiteral),
    float_literal: $ => token(floatLiteral),

    nil: $ => 'nil',
    true: $ => 'true',
    false: $ => 'false',

    _expression: $ => choice(
      $.parenthesized_expression,
      $.dereference_expression,
      $.selector_expression,
      $.call_expression,
      $.identifier,
      $._literal
    ),

    parenthesized_expression: $ => seq(
      '(', $._expression, ')'
    ),

    identifier: $ => token(seq(
      /[a-z_]/,
      repeat(choice(letter, unicodeDigit))
    )),

    dereference_expression: $ => seq(
      $.identifier,
      alias('^', $.operator),
    ),

    selector_expression: $ => seq(
      field('operand', $._expression),
      '.',
      field('field', $.identifier)
    ),

    call_expression: $ => choice(
      $._normal_call_expression,
      $._builtin_call_expression,
    ),
    _normal_call_expression: $ => seq(
      field('function_call', $._expression),
      field('arguments', $.arguments)
    ),
    _builtin_call_expression: $ => seq(
      field('function_call', alias(choice(...builtin_procs)), $.keyword),
      field('arguments', $.arguments)
    ),

    arguments: $ => seq(
      '(',
      commaSep(choice(
        $._type,
        $._expression,
      )),
      ')',
    ),

    _type: $ => choice(
      $.type_of_expression,
      $.type_identifier,
      $.type_pointer,
      $.type_multi_pointer,
      $.type_slice,
      $.type_fixed_array,
      $.type_dynamic_array,
      $.type_soa,
      $.type_proc,
      // TODO: other types
      // struct
      // union
    ),

    type_of_expression: $ => seq(
      alias('type_of', $.builtin_identifier),
      '(', $._expression, ')',
    ),

    _base_type: $ => choice(
      $.type_identifier,
      $.type_of_expression,
    ),

    type_identifier: $ => token(choice(
      choice(...builtin_types),
      seq(
        /[A-Z]/,
        repeat(choice(letter, unicodeDigit)),
      )
    )),
    type_pointer: $ => seq(
      alias('^', $.operator),
      $._base_type,
    ),
    type_multi_pointer: $ => seq(
      '[', alias('^', $.operator), ']',
      $._base_type,
    ),
    type_slice: $ => seq(
      '[]',
      $._base_type,
    ),
    type_fixed_array: $ => seq(
      '[', $._expression, ']',
      $._base_type,
    ),
    type_dynamic_array: $ => seq(
      '[', alias('dynamic', $.keyword), ']',
      $._base_type,
    ),
    type_soa: $ => seq(
      alias('#soa', $.keyword),
      choice(
        $.type_slice,
        $.type_fixed_array,
        $.type_dynamic_array,
      ),
    ),
    type_proc: $ => seq(
      alias('proc', $.keyword),
      '(', commaSep($._type), ')',
      optional(seq(
        '->',
        choice(
          $._type,
          seq('(', commaSep($._type), ')')
        )
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
