const
  PREC = {
    primary: 9,
    unary: 8,
    multiplicative: 7,
    additive: 6,
    comparative: 5,
    and: 4,
    or: 3,
    range: 2,
    composite_literal: -1,
  },

  unicodeLetter = /\p{L}/,
  unicodeLetterLower = /\p{Ll}/,
  unicodeLetterUpper = /\p{Lu}/,
  unicodeDigit = /[0-9]/,
  unicodeChar = /./,
  letter = choice(unicodeLetter, '_'),
  letterLower = choice(unicodeLetterLower, '_'),
  letterUpper = choice(unicodeLetterUpper, '_'),

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
  // TODO: make a custom scanner for float literal
  // https://github.com/gdamore/tree-sitter-d/blob/main/src/scanner.c#L565
  // NOTE: this does not allow lone trailing periods `0.`
  // range_operators(..<, ..=) and float_literal are conflicting
  // because `0.` is a valid syntax for a float
  decimalFloatLiteral = choice(
    seq(decimalDigits, '.', decimalDigits, decimalExponent),
    seq(decimalDigits, '.', choice(decimalDigits, decimalExponent)),
    seq(decimalDigits, decimalExponent),
    seq('.', decimalDigits, decimalExponent),
    seq('.', decimalDigits),
  ),
  floatLiteral = decimalFloatLiteral,

  builtin_types = [
    'typeid',
    'any',
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
    'uint', 'int',
    'uintptr', 'rawptr',
    'string', 'cstring', 'rune',
    'complex32', 'complex64', 'complex128',
    'quaternion64', 'quaternion128', 'quaternion256',
  ],

  builtin_procs = [
    'len',
    'swizzle',
    'alloc', 'realloc',
    'new', 'new_clone',
    'make', 'delete',
    'free', 'free_all',
    'size_of', 'align_of',
    'soa_zip', 'soa_unzip',
    'typeid_of', 'type_info_of',
  ]

module.exports = grammar({
  name: 'odin',

  extras: $ => [
    // multiline statement similar to python
    // https://github.com/tree-sitter/tree-sitter-python/blob/master/grammar.js#L32
    /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/,
    $.line_comment,
    $.block_comment,
  ],

  externals: $ => [
    $.block_comment, // this supports nested block comment
  ],

  conflicts: $ => [
    [$._simple_expression, $.identifier_list],
    [$._complex_expression, $._statement],
    [$._identifier, $.type_selector_expression],
    [$._type, $.enum_selector_expression],
    [$.type_proc, $.proc_literal],
    [$.type_fixed_array, $.fixed_array_literal],
    [$.block_statement, $.initializer_literal],
    [$.key_value_literal, $.expression_list],
    [$.key_value_literal, $.initializer_literal],
    [$.block_statement, $.key_value_literal, $.initializer_literal],
  ],

  rules: {
    source_file: $ => optional(seq(
      $._top_level_statement,
      repeat(seq(
        terminator,
        $._top_level_statement,
      )),
      optional(terminator),
    )),

    _top_level_statement: $ => choice(
      $.package_clause,
      $.import_declaration,
      $.foreign_block,
      $._statement,
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

    foreign_block: $ => seq(
      alias('foreign', $.keyword),
      $.identifier,
      $.block_statement,
    ),

    _declaration: $ => choice(
      $.attribute_declaration,
      $.const_declaration,
      $.var_declaration,
    ),

    attribute_declaration: $ => choice(
      $._attribute_declaration,
      $._attribute_declaration_objc_type,
    ),
    _attribute_declaration: $ => seq(
      '@(',
      field('attribute', alias($.identifier, $.keyword)),
      optional(seq(
        alias('=', $.operator),
        field('value', $._expression),
      )),
      ')',
    ),
    _attribute_declaration_objc_type: $ => seq(
      '@(',
      field('attribute', alias(token('objc_type'), $.keyword)),
      seq(
        alias('=', $.operator),
        field('value', $._type),
      ),
      ')'
    ),

    const_declaration: $ => seq(
      field('left', $.identifier_list),
      alias(':', $.operator),
      optional(field('type', $._type)),
      alias(':', $.operator),
      field('right', $.expression_type_list),
    ),

    var_declaration: $ => seq(
      field('left', $.identifier_list),
      alias(':', $.operator),
      choice(
        field('type', $._type),
        seq(
          optional(field('type', $._type)),
          alias('=', $.operator),
          field('right', $.expression_type_list)
        ),
      ),
    ),

    _statement: $ => seq(
      optional($.attribute_declaration),
      choice(
        $._declaration,
        $.assignment_statement,
        $.assignment_operation_statement,
        $.block_statement,
        $.defer_statement,
        $.using_statement,
        $.return_statement,
        $.for_statement,
        alias($.call_expression, $.call_statement),
        alias(seq('break', optional($._identifier)), $.break_statement),
        alias('continue', $.continue_statement),
        alias('fallthrough', $.fallthrough_statement),
        // TODO: other statements
        //   - if, when
        //   - switch
        //   - proc group https://odin-lang.org/docs/overview/#explicit-procedure-overloading
      ),
    ),

    defer_statement: $ => seq(
      alias('defer', $.keyword),
      $._statement,
    ),

    block_statement: $ => seq(
      optional(field('directive', alias(
        choice(
          token('#bounds_check'),
          token('#no_bounds_check'),
        ),
        $.directive,
      ))),
      '{',
      optional(seq(
        $._statement,
        optional(
          repeat(seq(
            terminator,
            $._statement,
          )),
        ),
        optional(terminator),
      )),
      '}',
    ),

    do_statement: $ => seq(
      alias('do', $.keyword),
      $._statement,
    ),

    assignment_statement: $ => seq(
      field('left', $.expression_list),
      alias('=', $.operator),
      field('right', $.expression_type_list),
    ),

    assignment_operation_statement: $ => seq(
      field('left', $._expression),
      alias(
        choice('+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '|=', '~=', '&=', '&~='),
        $.operator
      ),
      field('right', $._expression),
    ),

    using_statement: $ => seq(
      alias('using', $.keyword),
      $._expression,
    ),

    return_statement: $ => seq(
      alias('return', $.keyword),
      optional($.expression_type_list),
    ),

    for_statement: $ => choice(
      $._for_basic_statement,
      $._for_ranged_statement,
    ),
    _for_basic_statement: $ => seq(
      alias('for', $.keyword),
      optional(seq(
        field('initial', optional(seq(optional($._declaration), ';'))),
        field('condition', $._expression),
        field('post', optional(seq(';', optional(choice(
          $.assignment_operation_statement,
          $.block_statement,
        ))))),
      )),
      choice(
        $.block_statement,
        $.do_statement,
      ),
    ),
    _for_ranged_statement: $ => prec.right(1, seq(
      alias('for', $.keyword),
      $._expression,
      alias('in', $.keyword),
      $.range_expression,
      choice(
        $.block_statement,
        $.do_statement,
      ),
    )),

    identifier_list: $ => commaSep1(seq(
      optional(alias('using', $.keyword)),
      choice($._identifier, $.type_identifier),
    )),

    expression_list: $ => commaSep1($._expression),
    expression_type_list: $ => commaSep1(choice(
      $._expression,
      $._type,
      $.distinct_type,
    )),
    distinct_type: $ => seq(alias('distinct', $.keyword), $._type),

    _literal: $ => choice(
      $.nil,
      $.true,
      $.false,
      $.undefined_value,
      $._string_literal,
      $._numeric_literal,
      $.complex_literal,
      $.quaternion_literal,
      $.fixed_array_literal,
      $.slice_literal,
      $.proc_literal,
      $.key_value_literal,
      $.initializer_literal,
    ),

    nil: $ => 'nil',
    true: $ => 'true',
    false: $ => 'false',
    undefined_value: $ => '---',

    _numeric_literal: $ => choice(
      $.int_literal,
      $.float_literal,
    ),
    int_literal: $ => token(intLiteral),
    float_literal: $ => token(floatLiteral),
    complex_literal: $ => seq(
      $._numeric_literal,
      token.immediate(choice('i', 'j', 'k')),
    ),

    quaternion_literal: $ => seq(
      alias('quaternion', $.type_identifier),
      '(',
      commaSep1($._numeric_literal),
      ')',
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

    fixed_array_literal: $ => seq(
      '[',
      choice(
        $._expression,
        alias('?', $.keyword),
      ),
      ']',
      $._type,
      '{',
      commaSep($._expression),
      optional(','),
      '}',
    ),

    slice_literal: $ => choice(
      $._slice_literal,
      $._slice_literal_array,
    ),
    _slice_literal: $ => seq(
      $._expression,
      '[',
      optional($._expression),
      ':',
      optional($._expression),
      ']',
    ),
    _slice_literal_array: $ => seq(
      '[', ']',
      $._type,
      '{',
      commaSep($._expression),
      optional(','),
      '}',
    ),

    proc_literal: $ => seq(
      optional(alias(
        choice(
          token('#force_inline'),
          token('#force_no_inline'),
        ),
        $.directive,
      )),
      alias('proc', $.keyword),
      optional(newline),
      optional(field('calling_convention', $._string_literal)),
      field('parameters', $.parameters),
      optional(seq(
        alias('->', $.operator),
        optional(newline),
        field('result', $.proc_result),
      )),
      optional(seq(
        optional(newline),
        alias('where', $.keyword),
        optional(newline),
        $.expression_list,
      )),
      optional(alias(token('#optional_ok'), $.directive)),
      field('body', choice(
        $.block_statement,
        $.undefined_value,
      ))
    ),
    parameters: $ => seq(
      '(', commaSep($.parameter_declaration), ')',
    ),
    parameter_declaration: $ => choice(
      $._named_parameter_declaration,
      $._unnamed_parameter_declaration,
      // TODO: variadic parameter
    ),
    _named_parameter_declaration: $ => prec.right(1, seq(
      commaSep1(seq(
        optional(field('directive', $.directive)),
        optional(field('using', alias('using', $.keyword))),
        optional(alias('$', $.operator)), // compile-time parameter
        field('name', $.identifier),
      )),
      alias(':', $.operator),
      optional(alias('$', $.operator)), // generic type
      field('type', $._type),
      // TODO: generic specialization
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

    key_value_literal: $ => seq(
      optional($._type),
      '{',
      commaSep(seq(
        $._expression,
        alias('=', $.operator),
        $._expression
      )),
      optional(','),
      '}',
    ),

    initializer_literal: $ => seq(
      optional($._type),
      '{',
      commaSep($._expression),
      optional(','),
      '}',
    ),

    _expression: $ => prec.right(seq(
      choice(
        $._simple_expression,
        $._complex_expression,
        // TODO: other expressions
        //   - array indexing expression
        //   - matrix indexing expression
        //   - map indexing expression
      ),
      optional(alias('or_return', $.keyword)), // NOTE: not sure this is correct...
    )),
    _simple_expression: $ => choice(
      $._literal,
      $._identifier,
      $.context_variable,
      $.selector_expression,
      $.enum_selector_expression,
      $.implicit_selector_expression,
      $.or_else_expression,
      $.parenthesized_expression,
      $.type_conversion_expression,
      $.auto_cast_expression,
      $.cast_expression,
      $.transmute_expression,
      $.dereference_expression,
      $.unary_expression,
      $._ternary_expression,
    ),
    _complex_expression: $ => choice(
      $.type_assert_expression,
      $.optional_check_expression,
      $.binary_expression,
      $.call_expression,
    ),

    context_variable: $ => 'context',

    _identifier: $ => choice(
      $.identifier,
      $.const_identifier,
    ),
    identifier: $ => token(seq(
      letterLower,
      repeat(choice(letter, unicodeDigit))
    )),
    const_identifier: $ => token(seq(
      letterUpper,
      repeat(choice(letterUpper, unicodeDigit))
    )),

    dereference_expression: $ => seq(
      $._expression,
      alias('^', $.operator),
    ),

    selector_expression: $ => seq(
      field('operand', $._expression),
      '.',
      field('field', $._identifier),
    ),

    type_selector_expression: $ => seq(
      field('operand', $.identifier),
      '.',
      field('field', $.type_identifier),
    ),

    enum_selector_expression: $ => seq(
      field('enum', $.type_identifier),
      '.',
      field('field', alias($.type_identifier, $.enum_field)),
    ),
    implicit_selector_expression: $ => seq(
      '.',
      field('field', alias($.type_identifier, $.enum_field)),
    ),

    or_else_expression: $ => prec.left(seq(
      $._expression,
      alias('or_else', $.keyword),
      $._expression,
    )),

    type_assert_expression: $ => seq(
      $._expression,
      '.',
      '(',
      $._type,
      ')',
    ),

    optional_check_expression: $ => seq(
      $._expression,
      '.',
      '?',
    ),

    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-', '!', '~', '&')),
      field('operand', $._expression),
    )),

    _ternary_expression: $ => choice(
      $.ternary_c_like_expression,
      $.ternary_if_expression,
      $.ternary_when_expression,
    ),
    ternary_c_like_expression: $ => prec.right(seq(
      field('condition', $._expression),
      alias('?', $.keyword),
      $._expression,
      alias(':', $.keyword),
      $._expression,
    )),
    ternary_if_expression: $ => prec.right(seq(
      $._expression,
      alias('if', $.keyword),
      field('condition', $._expression),
      alias('else', $.keyword),
      $._expression,
    )),
    ternary_when_expression: $ => prec.right(seq(
      $._expression,
      alias('when', $.keyword),
      field('condition', $._expression),
      alias('else', $.keyword),
      $._expression,
    )),

    range_expression: $ => prec.right(PREC.range, seq(
      $._expression,
      token(choice('..<', '..=')),
      $._expression,
    )),

    binary_expression: $ => {
      const
        // https://odin-lang.org/docs/overview/#operator-precedence
        multiplicative_operators = ['*', '/', '%', '%%', '&', '&~', '<<', '>>'],
        additive_operators = ['+', '-', '|', '~', 'in', 'not_in'],
        comparative_operators = ['==', '!=', '<', '>', '<=', '>=']

      const table = [
        [PREC.multiplicative, choice(...multiplicative_operators)],
        [PREC.additive, choice(...additive_operators)],
        [PREC.comparative, choice(...comparative_operators)],
        [PREC.and, '&&'],
        [PREC.or, '||'],
      ];

      return choice(...table.map(([precedence, operator]) =>
        prec.right(precedence, seq(
          field('left', choice($._expression, $._type)),
          field('operator', alias(token(operator), $.operator)),
          field('right', choice($._expression, $._type)),
        )),
      ));
    },

    parenthesized_expression: $ => seq(
      '(', $._expression, ')'
    ),

    type_conversion_expression: $ => seq(
      $._type, '(', $._expression, ')'
    ),

    // NOTE: not sure which is correct, left or right
    auto_cast_expression: $ => prec.right(seq(
      alias('auto_cast', $.operator),
      $._expression,
    )),

    // NOTE: not sure which is correct, left or right
    cast_expression: $ => prec.right(seq(
      alias('cast', $.operator),
      '(',
      $._type,
      ')',
      $._expression,
    )),

    // NOTE: not sure which is correct, left or right
    transmute_expression: $ => prec.right(seq(
      alias('transmute', $.operator),
      '(',
      $._type,
      ')',
      $._expression,
    )),

    call_expression: $ => choice(
      prec(1, $._builtin_call_expression),
      prec(0, $._call_expression),
    ),
    _builtin_call_expression: $ => seq(
      field(
        'function_call',
        alias(choice(...builtin_procs, token(/#[^\s\(]+/)), $.builtin_procedure),
      ),
      field('arguments', $.arguments),
    ),
    _call_expression: $ => seq(
      field('function_call', $._expression),
      field('arguments', $.arguments),
    ),

    arguments: $ => seq(
      '(',
      commaSep(choice($.argument, $.named_argument)),
      ')',
    ),
    argument: $ => seq(
      field('value', choice(
        $._type,
        $._expression,
      ))
    ),
    named_argument: $ => seq(
      field('name', $.identifier),
      alias('=', $.operator),
      field('value', choice(
        $._type,
        $._expression,
      ))
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
      $.type_bit_set,
      $.type_matrix,
      $.type_map,
      $.type_simd,
      $.type_proc,
      $._type_value,
    ),
    _type: $ => seq(
      optional(field('directive', alias(token('#type'), $.directive))),
      choice(
        $._known_type,
        $.type_identifier,
        $.type_selector_expression,
      ),
    ),

    type_identifier: $ => token(seq(
      unicodeLetterUpper,
      repeat(choice(letter, unicodeDigit))
    )),

    type_of_expression: $ => seq(
      alias(token('type_of'), $.builtin_identifier),
      '(', $._expression, ')',
    ),

    type_pointer: $ => prec(PREC.unary, seq(
      alias('^', $.operator),
      $._type,
    )),
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
      alias(token('#soa'), $.directive),
      $.type_slice,
    ),
    type_soa_fixed_array: $ => seq(
      alias(token('#soa'), $.directive),
      $.type_fixed_array,
    ),
    type_soa_dynamic_array: $ => seq(
      alias(token('#soa'), $.directive),
      $.type_dynamic_array,
    ),

    type_bit_set: $ => seq(
      alias(token('bit_set'), $.type_identifier),
      '[',
      choice(
        $._type,
        $.range_expression,
      ),
      optional(seq(
        ';',
        $._type,
      )),
      ']',
    ),

    type_matrix: $ => seq(
      alias(token('matrix'), $.type_identifier),
      '[',
      $._simple_expression,
      ',',
      $._simple_expression,
      ']',
      $._type,
    ),

    type_map: $ => seq(
      alias(token('map'), $.type_identifier),
      '[',
      $._type,
      ']',
      $._type,
    ),

    type_simd: $ => seq(
      alias(token('#simd'), $.directive),
      $.type_fixed_array,
    ),

    directive: $ => choice(
      alias(token(/#[^\s]+/), $.directive),
      $._align_directive,
    ),
    _align_directive: $ => seq(
      alias(token('#align'), $.directive),
      $._simple_expression,
    ),

    type_proc: $ => seq(
      alias('proc', $.keyword),
      optional(newline),
      optional(field('calling_convention', $._string_literal)),
      field('parameters', $.parameters),
      optional(seq(
        alias('->', $.operator),
        optional(newline),
        field('result', $.proc_result)
      )),
    ),

    _type_value: $ => choice(
      $.type_value_struct,
      $.type_value_union,
      $.type_value_enum,
    ),

    type_value_struct: $ => seq(
      alias('struct', $.keyword),
      optional(field('directive', $.directive)),
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
      optional(field('directive', $.directive)),
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
      optional(field('directive', $.directive)),
      '{',
      optional(commaSep(field('field', $.type_value_enum_field))),
      optional(','),
      '}'
    ),
    type_value_enum_field: $ => seq(
      alias($.type_identifier, $.enum_field),
      optional(seq(
        alias('=', $.operator),
        $._expression
      ))
    ),

    line_comment: $ => token(seq('//', /.*/)),
  }
})

function sep(rule, separator) {
  return optional(sep1(rule, separator))
}
function sep1(rule, separator) {
  return seq(
    rule,
    repeat(seq(
      separator,
      rule,
    ))
  )
}

function commaSep(rule) {
  return sep(rule, ',')
}
function commaSep1(rule) {
  return sep1(rule, ',')
}
