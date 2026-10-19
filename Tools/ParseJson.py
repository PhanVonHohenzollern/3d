#!/usr/bin/env python3
"""Convert authoritative FLM XML to compact English-display JSON.

Python 3.9+, standard library only. The XML is the source of truth: never
rewrite, repair, or reject source restrictions based on inferred semantics.
Validation concerns conversion fidelity; unsupported runtime interpretation
is reported separately without blocking export. Run --help for all options.
"""
import argparse
import ast
import hashlib
import json
import re
from collections import defaultdict, deque
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path


# Default XML file for running directly from an IDE on Windows.
# A positional command-line source always overrides this setting.
DEFAULT_XML_PATH = Path(r"D:\New folder\BELIMO.xml")

VALUE_TYPES = {1: 'integer', 2: 'real', 3: 'string'}  # informational, raw codes retained


def scalar(text):
    if text is None:
        return None
    s = text.strip()
    if re.fullmatch(r'[+-]?\d+', s):
        try:
            return int(s)
        except ValueError:
            pass
    if re.fullmatch(r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?', s):
        try:
            return float(s)
        except ValueError:
            pass
    return s


def attrs(el):
    return {k: scalar(v) for k, v in el.attrib.items()} if el is not None else {}


def val(el, path, default=None):
    t = el.findtext(path) if el is not None else None
    return scalar(t) if t is not None else default


def guid(el):
    return el.findtext('./GUID') if el is not None else None


# Internal semantic marker: a present multilingual value has no EN translation.
# Not the same as an empty EN string (""), or missing XML data (None).
EN_ABSENT = {'_enAbsent': True}


def translation_map(el):
    """Read every language initially; keep present-but-empty STRINGs."""
    if el is None:
        return {}
    return {node.get('LANG', 'und'): node.text or '' for node in el.findall('STRING')}


def preferred_text(translations, preferred='EN'):
    # Strict EN. NEVER silently show PL/DE as English.
    return translations.get(preferred) if isinstance(translations, dict) else None


def english_cell(entry):
    """VALUE exists but MLSTRING empty -> ''; PL-only -> EN_ABSENT; no VALUE -> None."""
    if isinstance(entry, dict):
        if 'EN' in entry:
            return entry['EN']
        return dict(EN_ABSENT) if entry else ''
    return entry


def english_labels(values):
    """Present field with no English is explicit, not silently omitted."""
    return {key: ({'EN': tr['EN']} if 'EN' in tr else dict(EN_ABSENT))
            for key, tr in values.items()}


def table_text(entry):
    """Decode a stored VALUE entry, preserving an explicitly empty multilingual cell.

    A present <VALUE><MLSTRING/></VALUE> represents an empty cell (""),
    whereas an absent VALUE or an invalid VALUE_MAP reference is missing (None).
    """
    if isinstance(entry, dict):
        choice = preferred_text(entry)
        return english_cell(entry)
    return entry


def mlstrings(el):
    result = {}
    for m in el.findall('MLSTRING'):
        translations = translation_map(m)
        result[m.get('NAME', 'unnamed')] = translations
    return result


def lang_name(el, key='NAME', preferred='EN'):
    return preferred_text(mlstrings(el).get(key, {}), preferred)


def xml_tree(el):
    """Preserve all source language alternatives in unknown XML structures."""
    return {'tag': el.tag, 'attributes': dict(el.attrib),
            'text': (el.text or '').strip() or None,
            'children': [xml_tree(c) for c in el]}


def delimited_cells(text, expected=None):
    r"""Split an XML VALUE array while preserving positions and escaped semicolons.

    In FDESK tables, `\;` is a literal semicolon inside one cell, NOT a
    column/row separator. Other backslashes are preserved verbatim (e.g.
    paths and non-semicolon escape sequences). Do not discard leading or
    internal empty cells, which are meaningful table positions.
    """
    if text is None:
        return []
    pieces = []
    cell = []
    index = 0
    while index < len(text):
        char = text[index]
        if char == '\\' and index + 1 < len(text) and text[index + 1] == ';':
            cell.append(';')
            index += 2
            continue
        if char == ';':
            pieces.append(''.join(cell).strip())
            cell = []
        else:
            cell.append(char)
        index += 1
    pieces.append(''.join(cell).strip())
    # A final unescaped ';' is a terminator only when it is not needed to
    # represent an explicitly empty last row. Follow the existing COLS rule.
    if len(pieces) > 1 and pieces[-1] == '' and (expected is None or len(pieces) == expected + 1):
        pieces.pop()
    return pieces


def condition_fields(el):
    """Legacy dictionary interface; duplicate CND nodes remain in the raw list.

    This does not infer whether repeated condition fields mean OR/AND or a
    sequence of alternative cases. The compiler must handle that separately.
    """
    return {c.tag: ((c.text or '').strip() if c.tag.startswith('CND_VAL') else scalar(c.text))
            for c in el if c.tag.startswith('CND_')}


def condition_sequence(el):
    """Return original order only if the dictionary cannot represent it."""
    nodes = [c for c in el if c.tag.startswith('CND_')]
    return ([xml_tree(c) for c in nodes] if len({c.tag for c in nodes}) < len(nodes)
            else None)


def read_values(a, count, problems, table_id, index):
    type_code = scalar(a.get('TYPE'))
    values = []
    if type_code == 6 or any(v.find('MLSTRING') is not None for v in a.findall('VALUE')):
        dictionary = []
        for node in a.findall('VALUE'):
            ml = node.find('MLSTRING')
            dictionary.append(translation_map(ml) if ml is not None else (node.text or '').strip())
        mapping_text = a.findtext('VALUE_MAP')
        mapping = ([int(x) if x and re.fullmatch(r'[+-]?\d+', x) else None
                    for x in delimited_cells(mapping_text, count)]
                   if mapping_text is not None else None)
        if mapping is None and len(dictionary) == count:
            mapping = list(range(count))
        if mapping is not None:
            for ix in mapping:
                if not isinstance(ix, int) or ix < 0 or ix >= len(dictionary):
                    raise ValueError(f'CONVERTER_VALUE_MAP_UNSUPPORTED: table={table_id} column={index} index={ix}')
                values.append(table_text(dictionary[ix]))
        else:
            values = [table_text(v) for v in dictionary]
            if len(dictionary) != count:
                raise ValueError(f'CONVERTER_UNMAPPED_COLUMN_UNSUPPORTED: table={table_id} column={index}, {len(dictionary)} values vs {count} rows')
        return values, {'typeCode': type_code, 'dictionary': dictionary, 'valueMap': mapping,
                        'attributes': attrs(a),
                        'unknownXml': [xml_tree(n) for n in a if n.tag not in ('VALUE','VALUE_MAP')],
                        'rawValueNodes': [xml_tree(n) for n in a.findall('VALUE')]}

    # TYPE=5 stores typed per-row XML values (usually CTYPE=1/2) as
    # attributes, sometimes with no text content at all. Keep each complete
    # typed value as a row cell: consumers that do not understand TYPE=5
    # leave it opaque instead of silently coercing it to an empty string.
    if type_code == 5:
        nodes = a.findall('VALUE')
        if len(nodes) != count:
            raise ValueError(f'CONVERTER_TYPE5_LAYOUT_UNSUPPORTED: table={table_id} '
                             f'column={index}, {len(nodes)} VALUE elements vs {count} rows')
        typed = [{'_flmTypedValue': {'typeCode': 5,
                                     'attributes': dict(node.attrib),
                                     'text': (node.text or '').strip() if node.text is not None else None,
                                     'children': [xml_tree(child) for child in node]}}
                 for node in nodes]
        storage = {'typeCode': type_code, 'attributes': attrs(a),
                   'rawValueNodes': [xml_tree(node) for node in nodes],
                   'unknownXml': [xml_tree(n) for n in a if n.tag not in ('VALUE', 'VALUE_MAP')]}
        return typed, storage

    raw_cells = []
    value_nodes = a.findall('VALUE')
    for node in value_nodes:
        if list(node):
            raise ValueError(f'CONVERTER_UNSUPPORTED_VALUE_NODE: table={table_id} column={index} TYPE={type_code}; source preserved on disk')
        raw_cells.extend(delimited_cells(node.text, count if len(value_nodes) == 1 else None))
    for cell in raw_cells:
        if cell == '':
            values.append('')  # Empty XML cell, distinct from missing value (None).
        elif type_code == 3:
            values.append(cell)  # TYPE=3 is an identifier, even when it looks numeric.
        elif type_code in (1, 2):
            number = scalar(cell)
            # TYPE is source metadata, not a license to delete symbolic tokens.
            # A custom FLM table may contain formulas or technical placeholders.
            # Retain these verbatim and let the runtime interpret them.
            if isinstance(number, str):
                problems.append(f'OPAQUE_TABLE_TOKEN: {table_id} column {index}: {cell!r}; preserved')
            values.append(number)
        else:
            values.append(cell)  # Unknown types are never coerced.
    return values, {'typeCode': type_code, 'attributes': attrs(a),
                    'unknownXml': [xml_tree(n) for n in a if n.tag not in ('VALUE','VALUE_MAP')],
                     'rawValues': raw_cells, 'rawValueNodes': [xml_tree(n) for n in value_nodes]}

def parse_table(t, problems):
    spec = t.find('DEFSPEC')
    table_id = guid(t)
    if spec is None:
        problems.append(f'{table_id}: missing DEFSPEC')
        return {'guid': table_id, 'raw': xml_tree(t)}
    data = spec.find('VALUE_DOUBLEARRAY')
    name_nodes = spec.findall('./NAMES/MLSTRING')
    name_translations = [translation_map(n) for n in name_nodes]
    names = [preferred_text(tr) if preferred_text(tr) is not None else f'column_{i}' for i, tr in enumerate(name_translations)]
    # Unmodified NAMES nodes allow lossless recovery of columns, including PL-only names.
    raw_names = [xml_tree(n) for n in name_nodes]
    result = {'guid': table_id, 'producerGuid': t.findtext("GUID[@NAME='PROD_GUID']"),
              'legacyIds': [dict(x.attrib) for x in t.findall('./LEGACY_IDS/LEGACYID')],
              'id': spec.get('ID'), 'name': mlstrings(t).get('NAME', {}),
              'specAttributes': attrs(spec), 'columns': names, 'columnNamesI18n': name_translations, 'rawNames': raw_names, 'rows': [],
              'columnStorage': [], 'metadata': {
                  'version': xml_tree(t.find('VERSION')) if t.find('VERSION') is not None else None,
                  'producerGuidRaw': xml_tree(t.find("GUID[@NAME='PROD_GUID']")) if t.find("GUID[@NAME='PROD_GUID']") is not None else None,
                  'specExtras': [xml_tree(x) for x in spec if x.tag not in ('NAMES', 'VALUE_DOUBLEARRAY')],
                  'unknownTableNodes':[xml_tree(x) for x in t if x.tag not in ('GUID','VERSION','LEGACY_IDS','DEFSPEC','MLSTRING')]}}
    if data is None:
        result['raw'] = xml_tree(spec)
        return result
    result['arrayAttributes'] = attrs(data)
    # Legacy format: ROWS = number of variable columns, COLS = number of tuples.
    count = int(data.get('COLS', '0'))
    arrays = data.findall('VALUE_ARRAY')
    declared_columns = int(data.get('ROWS', str(len(arrays))))
    if count < 0 or declared_columns < 0 or declared_columns != len(arrays) or len(arrays) != len(names):
        raise ValueError(f'CONVERTER_UNSUPPORTED_ARRAY_LAYOUT: table={table_id}, '
                         f'COLS={count}, ROWS={declared_columns}, VALUE_ARRAY={len(arrays)}, NAMES={len(names)}')
    columns = []
    for i, a in enumerate(arrays):
        values, storage = read_values(a, count, problems, table_id, i)
        columns.append(values)
        result['columnStorage'].append(storage)
        if len(values) != count:
            raise ValueError(f'CONVERTER_ARRAY_LENGTH_AMBIGUOUS: table={table_id}: column {i} has {len(values)} entries; expected {count}')
    for row_idx in range(count):
        # Row as array preserves repeated names and column order.
        result['rows'].append([column[row_idx] if row_idx < len(column) else None for column in columns])
    return result


def parse_variable(v):
    # Repeated properties are authoritative XML entries, not parse errors.
    # The historical `properties` mapping is retained for existing clients,
    # while ordered repetitions are supplied through `propertySequence`.
    ordinary = [x for x in v if x.tag not in ('MLSTRING','DEFAULT_VALUES','OPTION_LIST')]
    d = {'id': v.get('ID'), 'key': v.get('KEY'), 'valueTypeCode': scalar(v.get('VAL_TYPE')),
         'variableTypeCode': scalar(v.get('VAR_TYPE')),
         'labels': mlstrings(v).get('CAPTION', {}),
         'defaultValues': [((x.text or '').strip() if scalar(v.get('VAL_TYPE')) == 3 else scalar(x.text))
                           for x in v.findall('./DEFAULT_VALUES/DEFAULT_VALUE')],
         'options': [{'value': ((pair.findtext('VALUE') or '').strip() if scalar(v.get('VAL_TYPE')) == 3
                                else scalar(pair.findtext('VALUE'))),
                      'labels': mlstrings(pair).get('CAPTION', {}),
                      'sourceAttributes': dict(pair.attrib),
                      'extraFields': [xml_tree(z) for z in pair if z.tag not in ('VALUE','MLSTRING')],
                      'raw': xml_tree(pair)}
                     for pair in v.findall('./OPTION_LIST/OPTION_PAIR')],
         'properties': {x.tag: scalar(x.text) for x in v
                        if x.tag not in ('MLSTRING', 'DEFAULT_VALUES', 'OPTION_LIST')},
         'rawAttributes': attrs(v)}
    if len({x.tag for x in ordinary}) < len(ordinary):
        d['propertySequence'] = [xml_tree(x) for x in ordinary]
    option_node = v.find('OPTION_LIST')
    d['rawOptionList'] = xml_tree(option_node) if option_node is not None else None
    if option_node is not None:
        if option_node.attrib: d['optionListAttributes'] = dict(option_node.attrib)
        extra_options = [xml_tree(z) for z in option_node if z.tag != 'OPTION_PAIR']
        if extra_options: d['optionListExtra'] = extra_options
    defaults_node = v.find('DEFAULT_VALUES')
    if defaults_node is not None and (defaults_node.attrib or
        any(z.tag != 'DEFAULT_VALUE' or z.attrib or list(z) for z in defaults_node)):
        d['defaultValuesRaw'] = xml_tree(defaults_node)
    d['labelsAll'] = mlstrings(v)
    d['visible'] = None  # Undocumented VAR_TYPE semantics: resolve in a separate UI policy.
    d['visibilityHint'] = 'hidden_candidate' if d['variableTypeCode'] == 7 else None
    return d


def parse_restriction(lim, idx):
    result = {'index': idx, 'tableGuid': guid(lim), 'typeCode': scalar(lim.get('TYPE')),
            'argumentCategory': val(lim, 'ARG_CAT'), 'conditionsRaw': condition_fields(lim),
            'sourceAttributes': dict(lim.attrib),
            'version': xml_tree(lim.find('VERSION')) if lim.find('VERSION') is not None else None,
            'bindings': [{'variable': x.findtext('VAR_NAME'), 'columnKey': scalar(x.get('KEY')),
                          'levelCode': scalar(x.get('LEVEL')), 'bindingTypeCode': scalar(x.get('TYPE')),
                           'otherAttributes':{k:v for k,v in x.attrib.items() if k not in ('KEY','LEVEL','TYPE')},
                           'unknownXml':[xml_tree(z) for z in x if z.tag!='VAR_NAME']}
                         for x in lim.findall('./DEF_ARGMAP/DEF_ARGMAPENTRY')],
            'extraFields': [xml_tree(x) for x in lim
                            if x.tag not in ('GUID', 'VERSION', 'ARG_CAT', 'DEF_ARGMAP')
                            and not x.tag.startswith('CND_')]}
    sequence = condition_sequence(lim)
    if sequence is not None:
        result['conditionSequence'] = sequence
    return result


def parse_connector(x):
    position = x.find('POSTION')
    if position is None:
        position = x.find('POSITION')
    fields_ordered = [z for z in x if z.tag not in ('POSTION','POSITION','MLSTRING')]
    # All connector MLSTRING nodes (not only LINK_LABEL) are canonical here.
    # Preserve a present but empty label as {} instead of dropping the node.
    labels = {m.get('NAME', 'unnamed'): translation_map(m) for m in x.findall('MLSTRING')}
    result = {'id': x.get('ID'), 'key': x.get('KEY'), 'attributes': attrs(x),
            'positionExpressions': dict(position.attrib) if position is not None else None,
            'diameterExpression': x.findtext('FDIAM'),
            'technologyExpression': x.findtext('DEF_TECHID'),
            'connectionTypeExpression': x.findtext('DEF_LINKTYPE'),
            'conditionsRaw': condition_fields(x),
            'labels': labels,
            'fields': {z.tag: ({'attributes':dict(z.attrib), 'text':scalar(z.text),
                                   'children':[xml_tree(c) for c in z]}
                                if list(z) else {'attributes':dict(z.attrib), 'text':scalar(z.text)}
                               if z.attrib else scalar(z.text)) for z in x
                       if z.tag not in ('POSTION', 'POSITION', 'MLSTRING')},
            'raw': xml_tree(x)}
    if len({z.tag for z in fields_ordered}) < len(fields_ordered):
        result['fieldSequence'] = [xml_tree(z) for z in fields_ordered]
    sequence = condition_sequence(x)
    if sequence is not None:
        result['conditionSequence'] = sequence
    return result


def parse_sub_element(x, index):
    """Only parse explicitly structured sub-element nodes; no guessed relations."""
    defs=x.find('VARIABLE_DEFINITIONS')
    if defs is None:defs=x.find('DEF_ENTITY/VARIABLE_DEFINITIONS')
    restrictions=x.find('DEF_LIMITLIST')
    if restrictions is None:restrictions=x.find('DEF_ENTITY/DEF_LIMITLIST')
    links=x.find('LINK_LIST')
    if links is None:links=x.find('DEF_ENTITY/LINK_LIST')
    embedded=x.find('DEF_ENTITY')
    geo=x.find('DEF_GEOMETRY')
    if geo is None and embedded is not None:geo=embedded.find('DEF_GEOMETRY')
    # Preserve XML structures without an understood parent/child binding contract.
    # Never discard the nested DEF_ENTITY just because some children were parsed.
    embedded_unknown=[xml_tree(z) for z in embedded if z.tag not in
        ('VARIABLE_DEFINITIONS','DEF_LIMITLIST','LINK_LIST','DEF_GEOMETRY')] if embedded is not None else []
    embedded_attributes=dict(embedded.attrib) if embedded is not None else {}
    return {'id': x.get('ID') or x.get('KEY') or f'sub:{index}',
            'xmlTag':x.tag,'attributes':dict(x.attrib),
            'variables':[parse_variable(v) for v in defs.findall('./DEFINITIONS/DEF_VARIABLE')] if defs is not None else [],
            'restrictions':[parse_restriction(r,i) for i,r in enumerate(restrictions.findall('DEF_LIMIT'))] if restrictions is not None else [],
            'connectors':[parse_connector(z) for z in links.findall('DEF_LINK')] if links is not None else [],
            'geometry':xml_tree(geo) if geo is not None else None,
            'parentBindingsRaw':embedded_unknown,
            'embeddedEntityAttributes':embedded_attributes,
            'unknownXml':[xml_tree(z) for z in x if z.tag not in
                ('VARIABLE_DEFINITIONS','DEF_LIMITLIST','LINK_LIST','DEF_ENTITY','DEF_GEOMETRY')]}



def find_sub_elements(d):
    if d is None:return [],set()
    recognized={'SUB_ELEMENT','SUBELEMENT','DEF_SUBELEMENT'}
    collections={'SUB_ELEMENTS','SUBELEMENTS','DEF_SUBELEMENTS'}
    items=[]; consumed=set()
    for child in d:
        if child.tag in recognized:
            items.append(child);consumed.add(child.tag)
        elif child.tag in collections:
            items.extend(list(child));consumed.add(child.tag)
    return [parse_sub_element(x,i) for i,x in enumerate(items)],consumed


def parse_entity(e):
    d = e.find('DEF_ENTITY')
    p = d.find('DEF_ENT_PROP') if d is not None else None
    symbol = lang_name(p, 'ENT_SYMBOL') if p is not None else None
    defs = d.find('./VARIABLE_DEFINITIONS') if d is not None else None
    geo = d.find('DEF_GEOMETRY') if d is not None else None
    sub_elements, sub_tags = find_sub_elements(d)
    return {'guid': guid(e),
            'version': xml_tree(e.find('VERSION')) if e.find('VERSION') is not None else None,
            'producerGuid': e.findtext("GUID[@NAME='PROD_GUID']"),
            'legacyIds': [dict(x.attrib) for x in e.findall('./LEGACY_IDS/LEGACYID')],
            'id': symbol or (d.get('ID') if d is not None else None) or guid(e),
            'xmlEntityId': d.get('ID') if d is not None else None,
            'entityType': d.get('TYPE') if d is not None else None,
            'groupType': val(e, 'GROUP_TYPE'),
            'names': mlstrings(p) if p is not None else {},
            'paths': [dict(attrs(x), value=x.text or '') for x in p.findall('PATH')] if p is not None else [],
            'variables': [parse_variable(v) for v in defs.findall('./DEFINITIONS/DEF_VARIABLE')] if defs is not None else [],
            'initialValuesRaw': xml_tree(defs.find('VALUES')) if defs is not None and defs.find('VALUES') is not None else None,
            'restrictions': [parse_restriction(x, i) for i, x in enumerate(d.findall('./DEF_LIMITLIST/DEF_LIMIT'))] if d is not None else [],
            'connectors': [parse_connector(x) for x in d.findall('./LINK_LIST/DEF_LINK')] if d is not None else [],
            'subElements':sub_elements,
            'geometry': xml_tree(geo) if geo is not None else None,
            'tableRefs': [x.text for x in e.findall('./TABLES/GUID')],
            'otherDefinitionFields': [xml_tree(x) for x in d if x.tag not in
                                      ({'DEF_ENT_PROP', 'VARIABLE_DEFINITIONS', 'DEF_LIMITLIST', 'LINK_LIST', 'DEF_GEOMETRY'} | sub_tags)] if d is not None else [],
            'rawAttributes': attrs(e),
            'metadataRaw': [xml_tree(x) for x in e if x.tag not in ('DEF_ENTITY', 'TABLES')],
            'entityPropertiesRaw': xml_tree(p) if p is not None else None,
            'entityDefinitionAttributes': attrs(d) if d is not None else {}}


def parse_technology(t):
    p = t.find('PIPING_TECH')
    return {'guid': guid(t), 'id': p.get('ID') if p is not None else guid(t),
            'names': mlstrings(p) if p is not None else {},
            'sizeTableName': p.findtext('SIZE_TABLE') if p is not None else None,
            'connectionCodes': [x.text for x in p.findall('./CONN_STRS/CONN_STR')] if p is not None else [],
            'tableRefs': [x.text for x in t.findall('./TABLES/GUID')],
            'properties': {x.tag: scalar(x.text) for x in p
                           if x.tag not in ('MLSTRING', 'SIZE_TABLE', 'CONN_STRS')} if p is not None else {},
            'raw': xml_tree(t)}


def parse_folder(f):
    return {'guid': guid(f), 'names': mlstrings(f), 'attributes': attrs(f),
            'entries': [{'guid': guid(e), 'names': mlstrings(e)} for e in f.findall('FOLDER_ENTRY')],
            'tableRefs': [x.text for x in f.findall('./TABLES/GUID')],
            'raw': xml_tree(f)}



def build_technology_alias_index(technology_nodes):
    """Resolve lexical DEF_TECHID references while all source languages are available.

    This index is transient: PL/DE/etc. display strings are not exported.
    Any alias shared by multiple technologies is deliberately ambiguous.
    """
    aliases = defaultdict(set)
    for node in technology_nodes:
        definition = node.find('PIPING_TECH')
        if definition is None:
            continue
        tech_id = definition.get('ID')
        if not tech_id:
            continue
        for alias in [tech_id, guid(node)]:
            if alias:
                aliases[alias].add(tech_id)
        for legacy in node.findall('./LEGACY_IDS/LEGACYID'):
            if legacy.get('ID'):
                aliases[legacy.get('ID')].add(tech_id)
        for ml in definition.findall("./MLSTRING[@NAME='TECH_NAME']"):
            for string in ml.findall('STRING'):
                if string.text and string.text.strip():
                    aliases[string.text.strip()].add(tech_id)
    return aliases


def resolve_connector_technologies(entities, technologies, aliases, problems):
    """Normalize static XML references, retaining exact technical source tokens."""
    for entity in entities:
        declared_variables = {v['id'] for v in entity.get('variables', []) if v.get('id')}
        for connector in entity.get('connectors', []):
            source = connector.get('technologyExpression')
            if not isinstance(source, str) or not source.strip() or source.startswith('%'):
                continue
            # A bare reference to a declared variable is dynamic (same as %var).
            # Preserve the original token for the consumer; do not resolve it as a static technology.
            if source in declared_variables:
                connector['technologyVariableRef'] = source
                continue
            # Expressions referencing element variables are not static IDs.
            if re.search(r'[+*()]', source) and source not in aliases:
                continue
            ids = aliases.get(source, set())
            if len(ids) == 1:
                tech_id = next(iter(ids))
                tech = technologies[tech_id]
                connector['technologyRef'] = {
                    'id': tech_id, 'guid': tech['guid'], 'source': source
                }
            elif len(ids) > 1:
                # Ambiguous inside this library. Never fall back to another library.
                connector['technologyResolution'] = {
                    'status': 'ambiguous-local', 'source': source,
                    'localCandidates': sorted(ids)
                }
                problems.append(f"AMBIGUOUS_LOCAL_TECHNOLOGY: {entity['id']}/{connector.get('id')}: {source!r}")
            else:
                connector['externalTechnologyRef'] = {'source': source, 'status': 'unresolved-in-this-library'}
                problems.append(f"TECHNOLOGY_NOT_DEFINED_LOCALLY: {entity['id']}/{connector.get('id')}: {source!r}")


def collect_missing_table_refs(entities, definitions):
    """Track library-level metadata links separately from active constraint factors."""
    missing = {}
    for entity_key, entity in entities.items():
        for index, table_guid in enumerate(entity.get('tableRefs', [])):
            if table_guid in definitions:
                continue
            record = missing.setdefault(table_guid, {'guid': table_guid, 'references': []})
            record['references'].append({
                'ownerType': 'entity', 'entityKey': entity_key,
                'ownerGuid': entity['guid'], 'index': index
            })
    return [missing[key] for key in sorted(missing)]


def inspect_runtime_interpretation_requirements(entities, tables, folders):
    """Report where consumers need FLM semantics, not alleged XML errors.

    Source XML is authoritative. A duplicated column binding, zero GUID, or
    apparent type mismatch may be perfectly valid in an FLM context. These
    observations must never block conversion and must never silently rewrite
    the raw definition.
    """
    notes = []
    for entity_key, entity in entities.items():
        defined = {v.get('id'): v for v in entity.get('variables', []) if v.get('id')}
        for rule in entity.get('restrictions', []):
            gid = rule.get('tableGuid')
            common = {'entity': entity_key, 'restriction': rule['index'],
                      'tableGuid': gid, 'severity': 'info', 'blocksConversion': False}
            if gid == '00000000-0000-0000-0000-000000000000':
                notes.append(dict(common, code='ZERO_GUID_RULE_REQUIRES_RUNTIME_SEMANTICS'))
                continue
            if not gid:
                continue
            table = tables.get(gid)
            if table is None:
                notes.append(dict(common, code='NONLOCAL_SPECIFICATION_REFERENCE'))
                continue
            cols = len(table.get('columns', []))
            if rule.get('bindings') and not table.get('rows'):
                notes.append(dict(common, code='EMPTY_TABLE_REQUIRES_RUNTIME_SEMANTICS'))
                continue
            by_var = defaultdict(set)
            for b in rule.get('bindings', []):
                col, name = b.get('columnKey'), b.get('variable')
                if type(col) is not int or not 0 <= col < cols:
                    notes.append(dict(common, code='COLUMN_REFERENCE_REQUIRES_RUNTIME_SEMANTICS',
                                      variable=name, columnKey=col, columnCount=cols))
                    continue
                if name:
                    by_var[name].add(col)
                meta = defined.get(name)
                if not meta:
                    continue
                kind = meta.get('valueTypeCode')
                if kind not in (1, 2, 3):
                    continue
                vals = [row[col] for row in table.get('rows', [])
                        if col < len(row) and row[col] is not None
                        and not (isinstance(row[col], dict) and row[col].get('_enAbsent'))]
                if not vals:
                    continue
                def same_source_kind(value):
                    if kind == 1:
                        return type(value) is int
                    if kind == 2:
                        return type(value) in (int, float)
                    return isinstance(value, str)
                if not any(same_source_kind(v) for v in vals):
                    notes.append(dict(common, code='TABLE_VALUE_COERCION_REQUIRES_RUNTIME_SEMANTICS',
                                      variable=name, valueTypeCode=kind,
                                      columnKey=col, example=vals[0]))
            for name, indices in by_var.items():
                if len(indices) >= 2:
                    notes.append(dict(common, code='MULTICOLUMN_BINDING_REQUIRES_RUNTIME_SEMANTICS',
                                      variable=name, columnKeys=sorted(indices)))
    return notes


def source_sha256(path):
    """Hash original XML bytes without normalizing the authoritative source."""
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def attach_verified_condition_lexemes(entities, tables):
    """Bridge technical condition literals to TYPE=6 dictionary values.

    XML conditions sometimes use a token in PL/DE/etc., while columnar JSON
    intentionally exposes EN cells. Match aliases ONLY via the *same library's*
    source dictionary and a DEF_ARGMAP binding to that exact variable/column.
    Keep conditionsRaw byte-for-byte; the canonical expression is a sidecar.
    Ambiguous aliases, expression references and unknown words are NOT guessed.
    This is a semantic binding, not display translation or a global vocabulary.
    """
    diagnostics = []
    for entity in entities:
        scopes = [entity] + list(entity.get('subElements', []))
        for scope in scopes:
            declared = {v.get('id') for v in scope.get('variables', [])}
            lexemes = defaultdict(lambda: defaultdict(list))
            for rule in scope.get('restrictions', []):
                table = tables.get(rule.get('tableGuid'))
                if table is None:
                    continue
                storages = table.get('columnStorage', [])
                for bind in rule.get('bindings', []):
                    name, index = bind.get('variable'), bind.get('columnKey')
                    if (not isinstance(name, str) or not re.fullmatch(r'[A-Za-z_][\w.]*', name)
                            or type(index) is not int or not (0 <= index < len(storages))):
                        continue
                    dictionary = storages[index].get('dictionary')
                    if not isinstance(dictionary, list):
                        continue
                    for entry in dictionary:
                        if not isinstance(entry, dict) or not isinstance(entry.get('EN'), str):
                            continue
                        canonical = entry['EN']
                        for language, token in entry.items():
                            if not isinstance(token, str):
                                continue
                            lexemes[name][token].append((canonical, table['guid'], index, language))
            # Only source-backed substitutions: an XML restriction can use a
            # different-language literal even when the storage column is EN.
            for owner in [*scope.get('restrictions', []), *scope.get('connectors', [])]:
                raw = owner.get('conditionsRaw') or {}
                if owner.get('conditionSequence'):
                    continue  # Duplicate keys retain their independent XML order.
                converted, evidence = {}, []
                for key, actual in raw.items():
                    if not key.startswith('CND_VAR') or not isinstance(actual, str):
                        continue
                    value_key = 'CND_VAL' + key[len('CND_VAR'):]
                    literal = raw.get(value_key)
                    if not isinstance(literal, str):
                        continue
                    # A declared variable is a reference, not a language literal.
                    if literal in declared or literal.startswith('%'):
                        continue
                    replacements = []
                    for token in literal.split(';'):
                        entry = lexemes[actual].get(token.strip(), [])
                        identities = {match[0] for match in entry}
                        if len(identities) == 1 and token.strip() not in identities:
                            canonical = next(iter(identities))
                            replacements.append(canonical)
                            proof = min(entry, key=lambda x: (x[1], x[2], x[3]))
                            evidence.append({'conditionKey': value_key, 'variable': actual,
                                'sourceLiteral': token.strip(), 'canonicalLiteral': canonical,
                                'sourceTableGuid': proof[1], 'columnKey': proof[2],
                                'sourceLanguage': proof[3]})
                        else:
                            replacements.append(token)
                            if len(identities) > 1:
                                diagnostics.append({'code': 'AMBIGUOUS_SOURCE_CONDITION_LEXEME',
                                    'entityGuid': entity.get('guid'), 'variable': actual,
                                    'condition': value_key, 'sourceLiteral': token,
                                    'candidates': sorted(identities)})
                    if replacements != literal.split(';'):
                        converted[value_key] = ';'.join(replacements)
                if converted:
                    owner['resolvedConditionsRaw'] = converted
                    owner['conditionCanonicalEvidence'] = evidence
    return diagnostics


def parse_library(path, entity_filter=None):
    tree = ET.parse(path)
    root = tree.getroot()
    if root.tag != 'FDESK_LIBRARY':
        raise ValueError(f'Expected FDESK_LIBRARY, got {root.tag}')
    problems = []
    notices = []  # Informational XML constructs: do not imply broken JSON.
    tables = {}
    for node in root.findall('FDESK_TABLE'):
        table_guid = guid(node)
        if not table_guid or table_guid in tables:
            raise ValueError(f'Missing or duplicate FDESK_TABLE GUID: {table_guid!r}')
        tables[table_guid] = parse_table(node, problems)
    technology_nodes = root.findall('FDESK_PIPETECH')
    technologies = {}
    for node in technology_nodes:
        tech = parse_technology(node)
        if not tech['id'] or tech['id'] in technologies:
            raise ValueError(f'Missing or duplicate PIPING_TECH ID: {tech["id"]!r}')
        technologies[tech['id']] = tech
    technology_aliases = build_technology_alias_index(technology_nodes)
    entities = [parse_entity(e) for e in root.findall('FDESK_ENTITY')]
    seen_entity_guids = set()
    for entity in entities:
        entity_guid = entity['guid']
        if not entity_guid or entity_guid in seen_entity_guids:
            raise ValueError(f'Missing or duplicate FDESK_ENTITY GUID: {entity_guid!r}')
        seen_entity_guids.add(entity_guid)
    resolve_connector_technologies(entities, technologies, technology_aliases, notices)
    notices.extend(attach_verified_condition_lexemes(entities, tables))
    if entity_filter:
        entities = [e for e in entities if e['id'] == entity_filter or e['guid'] == entity_filter]
        if not entities:
            raise ValueError(f'No entity with symbol/GUID {entity_filter!r}')
        # Keep only referenced tables, including technology tables when referenced by the entity.
        wanted = {r['tableGuid'] for e in entities for r in e['restrictions']}
        wanted.update(g for e in entities for g in e['tableRefs'])
        for entity in entities:
            for sub in entity.get('subElements', []):
                wanted.update(r['tableGuid'] for r in sub.get('restrictions', []))
            for connector in entity.get('connectors', []):
                tech_id = (connector.get('technologyRef') or {}).get('id')
                if tech_id in technologies:
                    wanted.update(technologies[tech_id].get('tableRefs', []))
                elif connector.get('technologyExpression'):
                    # Unknown/dynamic technology: cannot know the selected size table yet.
                    # Retain candidates rather than silently dropping shared dependencies.
                    wanted.update(g for tech in technologies.values() for g in tech.get('tableRefs', []))
        tables = {g: t for g, t in tables.items() if g in wanted}
    for e in entities:
        for r in e['restrictions']:
            g = r['tableGuid']
            if g is None:
                # Some DEF_LIMIT kinds are not backed by a FDESK_TABLE.
                continue
            if g not in tables:
                notices.append(f"NONLOCAL_OR_RUNTIME_SPECIFICATION: {e['id']} restriction {r['index']}: {g}")
            else:
                t = tables[g]
                r['specificationId'] = t.get('id')
                for b in r['bindings']:
                    k = b['columnKey']
                    b['columnName'] = t['columns'][k] if isinstance(k, int) and 0 <= k < len(t['columns']) else None
                    if b['columnName'] is None:
                        problems.append(f"{e['id']} restriction {r['index']}: invalid column key {k}")
    entity_map = {}
    for e in entities:
        key = e['id']
        if key in entity_map:
            notices.append(f'DUPLICATE_SYMBOL_WITH_DISTINCT_GUID: {key}; GUID-qualified key preserved')
            key = f"{key}@{e['guid']}"
        if key in entity_map:
            raise ValueError(f'Entity key collision: {key!r}')
        entity_map[key] = e
    missing_table_refs = collect_missing_table_refs(entity_map, tables)
    for entry in missing_table_refs:
        notices.append(f"NONLOCAL_METADATA_TABLE_REFERENCE: {entry['guid']} referenced "
                        f"{len(entry['references'])} time(s) in entity TABLES; non-blocking until used")
    prod = root.find('FDESK_PRODUCER')
    result = {'schemaVersion': '1.0', 'source': {'file': Path(path).name,
                                               'sha256': source_sha256(path),
                                               'authority': 'xml'},
              'library': {'guid': guid(root), 'version': xml_tree(root.find('VERSION')) if root.find('VERSION') is not None else None,
                          'format': val(root, 'FORMAT'),
                          'legacyPaths': [dict(attrs(x), value=x.text or '') for x in root.findall('./LEGACY_PATHS/PATH')],
                          'producer': {'guid': guid(prod), 'name': lang_name(prod)} if prod is not None else None},
              'entities': entity_map, 'specifications': tables,
              'technologies': technologies,
              'folders': [parse_folder(x) for x in root.findall('FDESK_FOLDER')],
               'unknownLibraryNodes': [xml_tree(x) for x in root if x.tag not in {
                   'GUID', 'VERSION', 'FORMAT', 'LEGACY_PATHS', 'FDESK_PRODUCER',
                   'FDESK_TABLE', 'FDESK_ENTITY', 'FDESK_PIPETECH', 'FDESK_FOLDER'}],
              'diagnostics': {'warnings': problems, 'notices': notices,
                              'missingTableRefs': missing_table_refs,
                              'missingTableRefCount': sum(len(item['references']) for item in missing_table_refs)},
              'notes': {'constraintGraph': 'Generic relational and formula supergraph is exported by default; undocumented TYPE/LEVEL roles remain unverified.',
                        'visible': 'No visibility inference; VAR_TYPE semantics must be verified.'}}
    interpretation_notes = inspect_runtime_interpretation_requirements(entity_map, tables, result['folders'])
    result['diagnostics']['interpretationNotes'] = interpretation_notes
    # Keep previous diagnostics shape for compatibility, but never classify
    # authoritative XML as erroneous based on guessed solver rules.
    result['diagnostics']['issues'] = interpretation_notes
    result['diagnostics']['errorCount'] = 0
    result['diagnostics']['sourceIsAuthoritative'] = True
    return result



def compact_library(data):
    """Remove duplicate XML-shaped copies while retaining normalized fields and source codes."""
    out = dict(data)
    out['schemaVersion'] = '1.1-compact'
    for table in out['specifications'].values():
        table.pop('rawNames', None)
        table.get('metadata', {}).pop('producerGuidRaw', None)
        # cells live exclusively in rows. Keep unique dictionaries and VALUE_MAPs.
        for column in table.get('columnStorage', []):
            column.pop('rawValues', None)
            column.pop('rawValueNodes', None)
        table.pop('raw', None) if 'rows' in table and table['rows'] else None
    for entity in out['entities'].values():
        entity.pop('metadataRaw', None)
        entity.pop('entityPropertiesRaw', None)
        # Normalized variable options/labels contain the actual data.
        for var in entity.get('variables', []):
            var.pop('rawOptionList', None)
            var.pop('labelsAll', None)
            for option in var.get('options', []):
                option.pop('raw', None)
        for connector in entity.get('connectors', []):
            connector.pop('raw', None)
    for tech in out['technologies'].values():
        tech.pop('raw', None)
    for folder in out['folders']:
        folder.pop('raw', None)
    out.get('notes', {}).update({'format': 'Shared table values stored once in rows; language maps and VALUE_MAP maintained; no XML tree duplication.'})
    return out


# -----------------------------------------------------------------------------
# FLM generic constraint hypergraph compiler
# -----------------------------------------------------------------------------
# All directions below come from explicit formula output fields. Table bindings,
# LIMIT comparisons and unknown FLM constructs remain RELATIONAL (simultaneous).
# In particular LEVEL and TYPE are source metadata, not guessed in/out markers.
GRAPH_SCHEMA_VERSION = 'FLM-CONSTRAINT-GRAPH-1'
GRAPH_FORMULA_CONSTANTS = frozenset(('pi', 'PI', 'e', 'E', 'true', 'false'))
GRAPH_FORMULA_FUNCTIONS = frozenset((
    'sin', 'cos', 'tan', 'cot', 'asin', 'acos', 'atan', 'sqrt', 'abs',
    'min', 'max', 'pow', 'round', 'floor', 'ceil', 'exp', 'log', 'mod',
    # Recognize a CALL, not its mathematical semantics. Actual evaluation is
    # left to a runtime with an implementation of the function.
    'rect_rad', 'circ_rad',
))
GRAPH_VERIFIED_EVALUATOR_FUNCTIONS = GRAPH_FORMULA_FUNCTIONS - frozenset(('rect_rad','circ_rad'))
GRAPH_IDENT = re.compile(r'(?<![\w.])%?([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*)')


def graph_expression_dependencies(expression, available):
    """Extract actual declared identifiers, retaining unknown token diagnostics.

    No XML expression is rewritten, algebraically simplified or evaluated here.
    Identifiers followed by '(' are function invocations, not input variables;
    unknown functions remain in `unknownFunctions`, never silently calculated.
    """
    if not isinstance(expression, str):
        return {'variables': [], 'undeclaredIdentifiers': [], 'unknownFunctions': []}
    inputs, missing, funcs = set(), set(), set()
    available = set(available)
    for match in GRAPH_IDENT.finditer(expression):
        name = match.group(1)
        following = expression[match.end():].lstrip()
        if following.startswith('('):
            if name not in GRAPH_VERIFIED_EVALUATOR_FUNCTIONS:
                # Unsupported geometry helpers remain visible in the graph.
                # Do not invent their formulas or return a fabricated value.
                funcs.add(name)
            continue
        if name in available:
            inputs.add(name)
        elif name not in GRAPH_FORMULA_CONSTANTS:
            missing.add(name)
    return {'variables': sorted(inputs), 'undeclaredIdentifiers': sorted(missing),
            'unknownFunctions': sorted(funcs)}


def _graph_condition_variables(conditions_raw, condition_sequence=None, declared=None):
    """Extract activation inputs without guessing condition operator semantics.

    XML CND_VAL may be a literal, a semicolon-separated literal set, OR a
    reference to another declared variable (e.g. CND_VAR=a, CND_VAL=b).
    When the latter is explicitly present in this entity's variable namespace,
    both sides are graph dependencies. Original condition order and values stay
    untouched in the exported restriction data.
    """
    declared = set(declared or [])
    result = set()
    def add(tag, value):
        if not isinstance(value, str) or not value:
            return
        if tag.startswith('CND_VAR'):
            referenced = graph_expression_dependencies(value, declared)
            if referenced['variables']:
                result.update(referenced['variables'])
            elif re.fullmatch(r'[A-Za-z_][A-Za-z_0-9.]*',value):
                result.add(value)  # An undeclared LHS must remain visible.
        elif tag.startswith('CND_VAL'):
            for item in value.split(';'):
                token=item.strip().lstrip('%')
                if token in declared:
                    result.add(token)
    if isinstance(conditions_raw, dict):
        for key, value in conditions_raw.items():
            add(key,value)
    for raw in condition_sequence or []:
        add(raw.get('tag',''),raw.get('text'))
    return sorted(result)


def _graph_scc(adjacency):
    """Tarjan SCC over supernode candidates, retaining deterministic ordering."""
    index = 0
    stack = []
    stacked = set()
    visits = {}
    low = {}
    components = []

    def visit(v):
        nonlocal index
        visits[v] = low[v] = index
        index += 1
        stack.append(v)
        stacked.add(v)
        for w in sorted(adjacency.get(v, ())):
            if w not in visits:
                visit(w)
                low[v] = min(low[v], low[w])
            elif w in stacked:
                low[v] = min(low[v], visits[w])
        if low[v] == visits[v]:
            component = []
            while True:
                w = stack.pop()
                stacked.remove(w)
                component.append(w)
                if w == v:
                    break
            components.append(tuple(sorted(component)))

    for vertex in sorted(adjacency):
        if vertex not in visits:
            visit(vertex)
    return sorted(components, key=lambda c: c[0])


def compile_entity_dependency_graph(entity_key, entity, specifications):
    """Compile one library-independent relational + directed factor graph.

    One table factor is a projection over exactly the source DEF_ARGMAP columns
    of ONE restriction. The runtime must read the original table row IDs and
    must retain tuple correlation within each projection. It must not compare
    two occurrences of the same variable unless XML semantics explicitly say
    to do so. No data cells or C++ code are changed here.

    Every arbitrary expression/restriction is represented, including those
    currently uninterpretable by the runtime. Unknown meaning is an explicit
    validation obligation, not a fabricated successful solve.
    """
    variables = {}
    factors = []
    projections = {}
    problems = []
    source_entity_id = entity.get('guid') or entity_key

    def node_id(scope, name):
        return f'{scope}/{name}'

    def register(scope, name, role='implicit', definition=None):
        if not isinstance(name, str) or not name:
            return None
        node = node_id(scope, name)
        if node not in variables:
            variables[node] = {'scope': scope, 'name': name, 'role': role}
        if definition is not None:
            variables[node]['role'] = 'declared'
            variables[node]['valueTypeCode'] = definition.get('valueTypeCode')
            variables[node]['variableTypeCode'] = definition.get('variableTypeCode')
        return node

    def add_factor(fid, kind, owner, bindings=None, inputs=None, outputs=None,
                   activation=None, source=None, **metadata):
        bindings = bindings or []
        inputs = list(dict.fromkeys(x for x in (inputs or []) if x))
        outputs = list(dict.fromkeys(x for x in (outputs or []) if x))
        activation = list(dict.fromkeys(x for x in (activation or []) if x))
        binding_nodes = list(dict.fromkeys(b['node'] for b in bindings if b.get('node')))
        coupled = list(dict.fromkeys(binding_nodes +
                 (inputs if kind in ('limit', 'opaque-restriction') else []) +
                 (outputs if kind in ('limit', 'opaque-restriction') else [])))
        record = {'id': fid, 'kind': kind, 'owner': owner,
                  'bindingNodes': binding_nodes,
                  'bindings': bindings,  # ORIGINAL XML ordered binding occurrences
                  'inputs': inputs, 'outputs': outputs,
                  'activationVariables': activation,
                  'coupledVariables': coupled, 'source': source}
        record.update(metadata)
        factors.append(record)

    def add_scope(scope, e, prefix):
        declared = {v['id']: v for v in e.get('variables', []) if v.get('id')}
        known = set(declared)
        # A declared-but-unused variable is still represented in the graph.
        for name, definition in declared.items():
            register(scope, name, definition=definition)
        for idx, rule in enumerate(e.get('restrictions', [])):
            owner = {'scope': scope, 'entityGuid': source_entity_id,
                     'restrictionIndex': rule.get('index', idx)}
            fid = f'{prefix}restriction:{idx}'
            bindings = []
            for i, binding in enumerate(rule.get('bindings', [])):
                name = binding.get('variable')
                node = register(scope, name)
                if node:
                    bindings.append({'node': node, 'variable': name,
                                     'columnKey': binding.get('columnKey'),
                                     'levelCode': binding.get('levelCode'),
                                     'bindingTypeCode': binding.get('bindingTypeCode'),
                                     'xmlBindingIndex': i})
            conditions = _graph_condition_variables(rule.get('conditionsRaw'), rule.get('conditionSequence'), known)
            activations = [register(scope, c, 'activation') for c in conditions]
            table_guid = rule.get('tableGuid')
            table = specifications.get(table_guid)
            source = {'tableGuid': table_guid, 'typeCode': rule.get('typeCode'),
                      'argumentCategory': rule.get('argumentCategory'),
                      'conditionsRaw': rule.get('conditionsRaw'),
                      'conditionSequence': rule.get('conditionSequence')}
            if table is not None:
                count = int(table.get('arrayAttributes', {}).get('COLS', 0))
                nc = len(table.get('columns', []))
                selected = sorted({b['columnKey'] for b in bindings
                                   if type(b['columnKey']) is int and 0 <= b['columnKey'] < nc})
                invalid = [b['columnKey'] for b in bindings if type(b['columnKey']) is not int
                           or b['columnKey'] < 0 or b['columnKey'] >= nc]
                # A projection never materializes duplicate table cells: a
                # consumer selects these columns at matching ORIGINAL row IDs.
                key = table_guid + '/' + ','.join(str(c) for c in selected)
                projections.setdefault(key, {'tableGuid': table_guid,
                         'columnKeys': selected, 'rowCount': count,
                         'rowIdentity': 'original-specification-row-index'})
                repeated = defaultdict(list)
                for b in bindings:
                    repeated[b['node']].append({'columnKey': b['columnKey'],
                                             'levelCode': b['levelCode'],
                                             'bindingTypeCode': b['bindingTypeCode']})
                repeated = {node: entries for node, entries in repeated.items()
                            if len({entry['columnKey'] for entry in entries}) > 1}
                if invalid:
                    problems.append({'code': 'INVALID_TABLE_COLUMN_REFERENCE', 'factor': fid,
                                     'tableGuid': table_guid, 'columnKeys': invalid})
                if repeated:
                    # LEVEL/TYPE may define overrides, inputs, or alternatives.
                    # Never collapse these to equality constraints in Python.
                    problems.append({'code': 'MULTICOLUMN_BINDING_SEMANTICS_UNVERIFIED',
                                     'factor': fid, 'variables': sorted(repeated)})
                add_factor(fid, 'table-projection', owner, bindings=bindings,
                           activation=activations, source=source, tableGuid=table_guid,
                           projectedColumns=selected, projectionId=key, rowCount=count,
                           repeatedVariableBindings=repeated,
                           unknownBindingColumns=invalid)
            elif not any(extra.get('tag') == 'LIMIT' for extra in rule.get('extraFields', [])):
                # A restriction with unknown/non-local/zero GUID may be a
                # legitimate non-table rule. Preserve and report its meaning.
                # But an ordinary TYPE=2 LIMIT *is itself* the constraint; it
                # must not acquire an additional phantom opaque factor.
                add_factor(fid, 'opaque-restriction', owner, bindings=bindings,
                           activation=activations, source=source,
                           tableGuid=table_guid, typeCode=rule.get('typeCode'))
                problems.append({'code':'OPAQUE_RESTRICTION_REQUIRES_RUNTIME_SEMANTICS',
                                 'factor':fid,'tableGuid':table_guid})
            # LIMIT nodes are RELATIONAL; NAME/EXPRESSION do not by themselves
            # authorize treating a LIMIT as a one-way assignment.
            for limit_i, extra in enumerate(rule.get('extraFields', [])):
                if extra.get('tag') != 'LIMIT':
                    continue
                fields = extra.get('attributes') or {}
                target = fields.get('NAME')
                expression = fields.get('EXPRESSION')
                deps = graph_expression_dependencies(expression, known)
                input_nodes = [register(scope, name) for name in deps['variables']]
                # Unknown identifiers are still graph nodes, so a missing
                # dependency is never silently trimmed from the supergraph.
                unknown_nodes = [register(scope, name) for name in deps['undeclaredIdentifiers']]
                target_node = register(scope, target)
                add_factor(f'{fid}:limit:{limit_i}', 'limit', owner,
                           inputs=input_nodes + unknown_nodes,
                           outputs=[target_node], activation=activations,
                           source={'expression':expression,
                                   'relationCode':fields.get('RELATION'),
                                   'typeCode':fields.get('TYPE'),
                                   'rawXml':extra},
                           undeclaredInputs=deps['undeclaredIdentifiers'],
                           unknownFunctions=deps['unknownFunctions'])
                if deps['undeclaredIdentifiers'] or deps['unknownFunctions']:
                    problems.append({'code':'LIMIT_EXPRESSION_REQUIRES_RUNTIME_SEMANTICS',
                                     'factor':f'{fid}:limit:{limit_i}',
                                     'undeclaredInputs':deps['undeclaredIdentifiers'],
                                     'unknownFunctions':deps['unknownFunctions']})

        # Connectors are distinct scopes. Their formulas are the only known
        # directional producers; literal technical codes are constants.
        for index, connector in enumerate(e.get('connectors', [])):
            connector_id = connector.get('id') or connector.get('key') or str(index)
            connector_scope = f'connector/{scope}/{index}:{connector_id}'
            cond = _graph_condition_variables(connector.get('conditionsRaw'), connector.get('conditionSequence'), known)
            activation_nodes = [register(scope, name, 'activation') for name in cond]
            expressions = {}
            for key, expression in (connector.get('positionExpressions') or {}).items():
                expressions['position.' + str(key)] = expression
            for key, field in [('diameter', 'diameterExpression'),
                               ('technology', 'technologyExpression'),
                               ('connectionType', 'connectionTypeExpression')]:
                if connector.get(field) is not None:
                    expressions[key] = connector[field]
            for name, expression in expressions.items():
                # DEF_TECHID and DEF_LINKTYPE can contain literal source tokens
                # (THR_STEEL, Plastic klejony, female, ...), *not* variable names.
                # A missing local technology definition is legal and never
                # means an implicit dependency on another library.
                literal = (name in ('technology','connectionType') and
                           isinstance(expression,str) and expression.strip() and
                           not expression.startswith('%') and expression not in known and
                           not any(operator in expression for operator in ('+','*','(',')','/','^')) and
                           connector.get('technologyVariableRef') != expression)
                derived = ({'variables':[], 'undeclaredIdentifiers':[], 'unknownFunctions':[]}
                           if literal else graph_expression_dependencies(expression, known))
                input_nodes = [register(scope, var) for var in derived['variables']]
                missing_nodes = [register(scope, var) for var in derived['undeclaredIdentifiers']]
                output = register(connector_scope, name, role='computed')
                fid = f'{prefix}connector:{index}:{name}'
                add_factor(fid, 'formula', {'scope':scope, 'connectorIndex':index},
                           inputs=input_nodes + missing_nodes, outputs=[output],
                           activation=activation_nodes, source={'expression':expression},
                           undeclaredInputs=derived['undeclaredIdentifiers'],
                           unknownFunctions=derived['unknownFunctions'])
                if derived['undeclaredIdentifiers'] or derived['unknownFunctions']:
                    problems.append({'code':'CONNECTOR_EXPRESSION_REQUIRES_RUNTIME_SEMANTICS',
                                     'factor':fid,
                                     'undeclaredInputs':derived['undeclaredIdentifiers'],
                                     'unknownFunctions':derived['unknownFunctions']})

    root_scope = 'element/' + entity_key
    add_scope(root_scope, entity, '')
    for sub_index, sub in enumerate(entity.get('subElements', [])):
        # No implied parent-to-child variable aliasing: even equal names are
        # different nodes unless explicit XML binds the scopes together.
        child_scope = 'subelement/' + entity_key + '/' + str(sub_index) + ':' + str(sub.get('id'))
        add_scope(child_scope, sub, 'subelement:' + str(sub_index) + ':')
        if sub.get('parentBindingsRaw'):
            problems.append({'code':'SUBELEMENT_PARENT_BINDING_REQUIRES_RUNTIME_SEMANTICS',
                             'scope':child_scope})

    # A) Undirected hyperedges: simultaneous relational constraints, joined
    # only when they actually share variable nodes. Formula/activation inputs
    # are directional reads, never an excuse to merge two huge table groups.
    parent = {f['id']:f['id'] for f in factors}

    def root(fid):
        while parent[fid] != fid:
            parent[fid] = parent[parent[fid]]
            fid = parent[fid]
        return fid

    def union(a, b):
        ra, rb = root(a), root(b)
        if ra != rb:
            parent[rb] = ra

    coupled_seen = {}
    for f in factors:
        for node in f['coupledVariables']:
            prev = coupled_seen.get(node)
            if prev is not None:
                union(prev, f['id'])
            else:
                coupled_seen[node] = f['id']

    # B) Factor producers (formula outputs and relational participants), and
    # all consumers (formula/condition input or coupled factor). Produce the
    # minimal directional edges between provisional supernodes.
    producers = defaultdict(set)
    readers = defaultdict(set)
    for f in factors:
        fid = f['id']
        if f['kind'] == 'formula':
            for node in f['outputs']:
                producers[node].add(fid)
            for node in f['inputs'] + f['activationVariables']:
                readers[node].add(fid)
        else:
            for node in f['coupledVariables']:
                producers[node].add(fid)
            for node in f['activationVariables']:
                readers[node].add(fid)
    # A formula's output can also be consumed relationally or in another
    # formula; create edges without guessing a table solve direction.
    for f in factors:
        if f['kind'] != 'formula':
            for node in f['coupledVariables']:
                readers[node].add(f['id'])

    directed = set()
    for node in sorted(set(producers) | set(readers)):
        for producer in producers[node]:
            for reader in readers[node]:
                if root(producer) != root(reader):
                    directed.add((root(producer), root(reader), node))

    adjacency = {root(fid):set() for fid in parent}
    for a,b,_ in directed:
        adjacency[a].add(b)
    sccs = _graph_scc(adjacency)
    group_member_ids = []
    for component in sccs:
        member_ids = sorted(fid for fid in parent if root(fid) in component)
        group_member_ids.append(member_ids)
    group_for = {fid:'G'+str(i) for i,g in enumerate(group_member_ids) for fid in g}
    directed_groups = sorted({(group_for[a],group_for[b]) for a,b,_ in directed
                              if group_for[a]!=group_for[b]})

    incoming = defaultdict(int)
    outgoing = defaultdict(set)
    for a,b in directed_groups:
        if b not in outgoing[a]:
            outgoing[a].add(b)
            incoming[b] += 1
    ready = sorted(g for g in set(group_for.values()) if incoming[g] == 0)
    solve_order = []
    while ready:
        group_id = ready.pop(0)
        solve_order.append(group_id)
        for follower in sorted(outgoing[group_id]):
            incoming[follower] -= 1
            if incoming[follower] == 0:
                ready.append(follower)
                ready.sort()
    if len(solve_order) != len(group_member_ids):
        raise ValueError('GRAPH_COMPILER_INTERNAL_ERROR: condensed supergraph contains a cycle')

    factors_by_id = {f['id']:f for f in factors}
    groups = []
    for i, members in enumerate(group_member_ids):
        scope_nodes = sorted(set(
            node for fid in members
            for field in ('coupledVariables', 'inputs', 'outputs', 'activationVariables')
            for node in factors_by_id[fid][field]))
        group_factor_types = sorted(set(factors_by_id[fid]['kind'] for fid in members))
        groups.append({'id': 'G'+str(i), 'factorIds': members,
                       'variables':scope_nodes, 'factorKinds':group_factor_types,
                       'tableRowScans':sum(factors_by_id[fid].get('rowCount',0)
                                           for fid in members),
                       'solveMode': ('relational-join-and-propagate'
                                     if any(factors_by_id[fid]['kind'] in
                                            ('table-projection','limit','opaque-restriction')
                                            for fid in members) else 'formula-evaluation'),
                       'requiresRuntimeSemantics':any(
                           factors_by_id[fid]['kind']=='opaque-restriction' or
                           bool(factors_by_id[fid].get('unknownBindingColumns')) or
                           bool(factors_by_id[fid].get('repeatedVariableBindings'))
                           for fid in members)})

    # C) Static incremental invalidation index. Impact travels forward, never
    # recomputes unrelated groups merely because their tables are in the library.
    variable_users = defaultdict(set)
    for f in factors:
        for field in ('coupledVariables', 'inputs', 'outputs', 'activationVariables'):
            for node in f[field]:
                variable_users[node].add(group_for[f['id']])
    return {'version': GRAPH_SCHEMA_VERSION, 'entityKey':entity_key,
            'entityGuid':source_entity_id,
            'variables':variables,
            'factors':factors,
            'tableProjections':projections,
            'superGraph':{'groups':groups,
                          'edges':[{'from':a,'to':b} for a,b in directed_groups],
                          'solveOrder':solve_order,
                          'mode':'mixed-relational-and-explicit-formula-dependencies'},
            'variableGroups':{node:sorted(groups) for node,groups in variable_users.items()},
            'runtimeSemanticsNeeded':problems}


def compile_constraint_graph(data):
    """Return a generic per-entity graph for every entity in one XML library.

    This output is deterministic and does not depend on a fixed vocabulary of
    parameter names, library technologies, source code or a global registry.
    """
    return {key:compile_entity_dependency_graph(key,entity,data['specifications'])
            for key,entity in data['entities'].items()}



def validate_compiled_constraint_graphs(parsed, graphs):
    """Check that a compiled graph neither drops nor invents source relations.

    This is a structural fidelity test, NOT a proof that each XML condition or
    formula is executable or that an element has a valid configuration.
    """
    report = {'entities':0,'declaredVariables':0,'restrictionFactors':0,
              'limitFactors':0,'connectorFormulaFactors':0,'tableProjections':0,
              'superGroups':0,'directedGroupEdges':0,'runtimeInterpretationIssues':0}
    if set(graphs) != set(parsed['entities']):
        raise ValueError('GRAPH_FIDELITY: entity keys differ')
    for key, entity in parsed['entities'].items():
        graph = graphs[key]
        factors = {f['id']:f for f in graph['factors']}
        if len(factors) != len(graph['factors']):
            raise ValueError('GRAPH_FIDELITY: duplicate factor IDs for ' + key)
        root_scope = 'element/' + key
        for variable in entity.get('variables', []):
            if variable.get('id'):
                node = root_scope + '/' + variable['id']
                if node not in graph['variables'] or graph['variables'][node]['role'] != 'declared':
                    raise ValueError('GRAPH_FIDELITY: declared variable missing: ' + node)
                report['declaredVariables'] += 1
        scopes = [(entity, '', root_scope)]
        for i, sub in enumerate(entity.get('subElements', [])):
            scopes.append((sub, 'subelement:'+str(i)+':',
                           'subelement/'+key+'/'+str(i)+':'+str(sub.get('id'))))
        for definition, prefix, scope in scopes:
            for index, rule in enumerate(definition.get('restrictions', [])):
                fid = prefix + 'restriction:' + str(index)
                expected_table = parsed['specifications'].get(rule.get('tableGuid'))
                expected_type = 'table-projection' if expected_table is not None else 'opaque-restriction'
                if expected_table is None and any(x.get('tag')=='LIMIT' for x in rule.get('extraFields', [])):
                    expected_type = None
                factor = factors.get(fid)
                if expected_type and (factor is None or factor['kind'] != expected_type):
                    raise ValueError('GRAPH_FIDELITY: restriction factor mismatch: ' + key+'/'+fid)
                if expected_type is None and factor is not None:
                    raise ValueError('GRAPH_FIDELITY: phantom factor for LIMIT: '+key+'/'+fid)
                if expected_table is not None:
                    report['restrictionFactors'] += 1
                    expected_bindings = rule.get('bindings', [])
                    actual_bindings = factor['bindings']
                    if len(expected_bindings) != len(actual_bindings):
                        raise ValueError('GRAPH_FIDELITY: binding count: '+key+'/'+fid)
                    for i,(before,after) in enumerate(zip(expected_bindings,actual_bindings)):
                        for input_key, output_key in [('variable','variable'),('columnKey','columnKey'),
                                  ('levelCode','levelCode'),('bindingTypeCode','bindingTypeCode')]:
                            if before.get(input_key) != after.get(output_key):
                                raise ValueError('GRAPH_FIDELITY: binding %d %s %s/%s' %
                                                 (i,input_key,key,fid))
                    projection = graph['tableProjections'].get(factor['projectionId'])
                    if projection is None or projection['tableGuid'] != rule['tableGuid']:
                        raise ValueError('GRAPH_FIDELITY: projection missing: '+key+'/'+fid)
                    table_columns = len(expected_table.get('columns', []))
                    selected = sorted({binding['columnKey'] for binding in expected_bindings
                                       if type(binding.get('columnKey')) is int and
                                       0 <= binding['columnKey'] < table_columns})
                    if projection['columnKeys'] != selected:
                        raise ValueError('GRAPH_FIDELITY: projection columns mismatch: '+key+'/'+fid)
                    if projection['rowCount'] != int(expected_table.get('arrayAttributes',{}).get('COLS',0)):
                        raise ValueError('GRAPH_FIDELITY: projection row count mismatch: '+key+'/'+fid)
                report['limitFactors'] += sum(1 for i,x in enumerate(rule.get('extraFields',[]))
                    if x.get('tag')=='LIMIT' and factors.get(fid+':limit:'+str(i),{}).get('kind')=='limit')
                expected_limits = sum(x.get('tag')=='LIMIT' for x in rule.get('extraFields',[]))
                actual_limits = sum(x.get('tag')=='LIMIT' and
                     factors.get(fid+':limit:'+str(i),{}).get('kind')=='limit'
                     for i,x in enumerate(rule.get('extraFields',[])))
                if actual_limits != expected_limits:
                    raise ValueError('GRAPH_FIDELITY: LIMIT dropped: '+key+'/'+fid)
            for i,c in enumerate(definition.get('connectors',[])):
                exprs = len(c.get('positionExpressions') or {}) + sum(
                    c.get(name) is not None for name in ('diameterExpression',
                        'technologyExpression','connectionTypeExpression'))
                prefix_con = prefix+'connector:'+str(i)+':'
                found = sum(f['kind']=='formula' and f['id'].startswith(prefix_con)
                            for f in graph['factors'])
                if found != exprs:
                    raise ValueError('GRAPH_FIDELITY: connector formulas mismatch: '+key+'/'+prefix_con)
                report['connectorFormulaFactors'] += found
        supergraph = graph['superGraph']
        groups = supergraph['groups']
        ordered = supergraph['solveOrder']
        ids = [g['id'] for g in groups]
        if sorted(ids) != sorted(ordered) or len(ids) != len(ordered):
            raise ValueError('GRAPH_FIDELITY: solve order is incomplete: '+key)
        assigned = [fid for g in groups for fid in g['factorIds']]
        if len(assigned) != len(set(assigned)) or set(assigned) != set(factors):
            raise ValueError('GRAPH_FIDELITY: group lost or duplicated factors: '+key)
        positions = {group:index for index,group in enumerate(ordered)}
        for edge in supergraph['edges']:
            if positions[edge['from']] >= positions[edge['to']]:
                raise ValueError('GRAPH_FIDELITY: dependency order violated: '+key)
        report['tableProjections'] += len(graph['tableProjections'])
        report['superGroups'] += len(groups)
        report['directedGroupEdges'] += len(supergraph['edges'])
        report['runtimeInterpretationIssues'] += len(graph['runtimeSemanticsNeeded'])
        report['entities'] += 1
    return report


def graph_for_lazy_library(library, entity_key):
    """Return a graph from optimized JSON, or compile lazily from older JSON."""
    actual_key, entity = library.entity(entity_key)
    # The published constraintGraphs field is deliberately compact. For CLI
    # inspection rebuild the verbose plan from preserved source definitions,
    # allowing this same command to work on old packed libraries too.
    references = {r.get('tableGuid') for r in entity.get('restrictions', [])}
    for sub in entity.get('subElements', []):
        references.update(r.get('tableGuid') for r in sub.get('restrictions', []))
    available = {guid:library.table(guid) for guid in references if guid}
    return compile_entity_dependency_graph(actual_key, entity,
                                           {k:v for k,v in available.items() if v is not None})


def graph_slice(graph, names, mode='requirements'):
    """Prune only proven-unrelated groups; keep relational groups intact.

    requirements: selected outputs + all predecessor groups.
    affected: selected changed values + all descendant groups.
    """
    all_nodes = graph['variables']
    wanted = set()
    for name in names:
        if name in all_nodes:
            wanted.add(name)
            continue
        suffix = '/' + name
        hits = [n for n in all_nodes if n.endswith(suffix)]
        if len(hits) == 1:
            wanted.add(hits[0])
        elif not hits:
            raise ValueError('GRAPH_FOCUS: unknown variable: '+name)
        else:
            raise ValueError('GRAPH_FOCUS: ambiguous variable '+name+', use scope: '+repr(hits))
    starts = set(group for node in wanted for group in graph['variableGroups'].get(node, []))
    previous = defaultdict(set)
    nexts = defaultdict(set)
    for edge in graph['superGraph']['edges']:
        previous[edge['to']].add(edge['from'])
        nexts[edge['from']].add(edge['to'])
    transitions = previous if mode == 'requirements' else nexts
    selected = set(starts)
    queue = deque(sorted(starts))
    while queue:
        source = queue.popleft()
        for neighbor in sorted(transitions[source]):
            if neighbor not in selected:
                selected.add(neighbor)
                queue.append(neighbor)
    original = graph['superGraph']
    return {'requestedVariables':sorted(wanted), 'mode':mode,
            'selectedGroupIds':[g for g in original['solveOrder'] if g in selected],
            'solveOrder':[g for g in original['solveOrder'] if g in selected],
            'groupCount':len(selected),
            'factorCount':sum(len(g['factorIds']) for g in original['groups'] if g['id'] in selected),
            'groups':[g for g in original['groups'] if g['id'] in selected],
            'edges':[edge for edge in original['edges'] if
                     edge['from'] in selected and edge['to'] in selected]}


def compact_constraint_graphs(graphs):
    """Pack compiled plans without repeating XML restrictions, columns or cells.

    The source entity restrictions, table payloads and connector expressions are
    already stored losslessly in `entities` and `specifications`. Therefore graph
    factors store source IDs, integer node IDs, and projected source column IDs;
    a consumer always reads row values from the original specification table.

    Compact format per entity:
      nodes = fully scoped variable names, sorted
      factors[i] = [sourceFactorId, kindCode, coupledNodes, inputNodes,
                    outputNodes, activationNodes, projectedColumnIndices|null]
      groups = arrays of factor indices (SCC/simultaneous supernodes)
      edges = [fromGroupIndex, toGroupIndex], DAG only
      order = group indices in topological order
      issues = [diagnosticCode, sourceFactorId] (not permission to ignore rule)

    Codes: T table projection; L LIMIT comparison; O opaque restriction;
    F directed connector formula. Every factor remains traceable to XML.
    """
    kinds={'table-projection':'T','limit':'L','opaque-restriction':'O','formula':'F'}
    result={}
    for key, graph in graphs.items():
        nodes=sorted(graph['variables'])
        node_ids={node:i for i,node in enumerate(nodes)}
        factors=graph['factors']
        factor_ids={factor['id']:i for i,factor in enumerate(factors)}
        supergraph=graph['superGraph']
        groups=supergraph['groups']
        group_ids={group['id']:i for i,group in enumerate(groups)}
        def encode_nodes(values):
            return [node_ids[node] for node in values]
        encoded_factors=[]
        for factor in factors:
            encoded_factors.append([
                factor['id'], kinds[factor['kind']],
                encode_nodes(factor['coupledVariables']),
                encode_nodes(factor['inputs']),
                encode_nodes(factor['outputs']),
                encode_nodes(factor['activationVariables']),
                factor.get('projectedColumns')])
        issues=sorted({(problem['code'],problem.get('factor',''))
                       for problem in graph['runtimeSemanticsNeeded']})
        result[key]={'v':GRAPH_SCHEMA_VERSION,
                     'nodes':nodes,
                     'factors':encoded_factors,
                     'groups':[[factor_ids[fid] for fid in group['factorIds']]
                               for group in groups],
                     'edges':[[group_ids[edge['from']],group_ids[edge['to']]]
                              for edge in supergraph['edges']],
                     'order':[group_ids[group_id] for group_id in supergraph['solveOrder']],
                     'issues':[list(issue) for issue in issues]}
    return result


def validate_compact_constraint_graphs(full_graphs, compacted):
    """Reconstruct essential graph structure and compare without trusting packer."""
    if set(full_graphs)!=set(compacted):
        raise ValueError('GRAPH_PACKING: entity list mismatch')
    counters={'entities':0,'factors':0,'superGroups':0,'edges':0}
    kinds={'T':'table-projection','L':'limit','O':'opaque-restriction','F':'formula'}
    for key, graph in full_graphs.items():
        packed=compacted[key]
        if packed['v']!=GRAPH_SCHEMA_VERSION:
            raise ValueError('GRAPH_PACKING: unsupported graph version')
        nodes=packed['nodes'];factors=graph['factors']
        if nodes!=sorted(graph['variables']) or len(factors)!=len(packed['factors']):
            raise ValueError('GRAPH_PACKING: nodes/factors mismatch: '+key)
        for full, short in zip(factors,packed['factors']):
            fid,code,coupled,inputs,outputs,activation,columns=short
            if fid!=full['id'] or kinds[code]!=full['kind']:
                raise ValueError('GRAPH_PACKING: factor identity mismatch: '+key+'/'+fid)
            for name,ids in [('coupledVariables',coupled),('inputs',inputs),
                             ('outputs',outputs),('activationVariables',activation)]:
                if any(type(i) is not int or i<0 or i>=len(nodes) for i in ids) or\
                   [nodes[i] for i in ids]!=full[name]:
                    raise ValueError('GRAPH_PACKING: factor edge mismatch: '+key+'/'+fid+'/'+name)
            if columns!=full.get('projectedColumns'):
                raise ValueError('GRAPH_PACKING: projection columns differ: '+key+'/'+fid)
        groups=graph['superGraph']['groups']
        if len(groups)!=len(packed['groups']):
            raise ValueError('GRAPH_PACKING: number of supergroups: '+key)
        for g,encoded_ids in zip(groups,packed['groups']):
            if [factors[i]['id'] for i in encoded_ids]!=g['factorIds']:
                raise ValueError('GRAPH_PACKING: supergroup factor mapping: '+key+'/'+g['id'])
        for pair,edge in zip(packed['edges'],graph['superGraph']['edges']):
            if [groups[pair[0]]['id'],groups[pair[1]]['id']]!=[edge['from'],edge['to']]:
                raise ValueError('GRAPH_PACKING: directed edge differs: '+key)
        if len(packed['edges'])!=len(graph['superGraph']['edges']):
            raise ValueError('GRAPH_PACKING: lost directed edge: '+key)
        if [groups[i]['id'] for i in packed['order']]!=graph['superGraph']['solveOrder']:
            raise ValueError('GRAPH_PACKING: topological order differs: '+key)
        expected_issues=sorted({(issue['code'],issue.get('factor',''))
                                for issue in graph['runtimeSemanticsNeeded']})
        if [tuple(item) for item in packed['issues']]!=expected_issues:
            raise ValueError('GRAPH_PACKING: interpretation warnings lost: '+key)
        counters['entities']+=1
        counters['factors']+=len(factors)
        counters['superGroups']+=len(groups)
        counters['edges']+=len(graph['superGraph']['edges'])
    return counters


def english_only(value):
    """Keep English display data; never drop technical XML attribute values.

    Raw XML fragments from unsupported tags are retained, but non-English STRING
    children are pruned. For a present MLSTRING with no EN children the marker
    records that an English label is unavailable.
    """
    if isinstance(value, dict):
        if value.get('tag') == 'MLSTRING' and 'children' in value:
            out = {k: english_only(v) for k,v in value.items() if k != 'children'}
            en_children = [english_only(v) for v in value['children']
                           if v.get('tag') != 'STRING' or v.get('attributes',{}).get('LANG') == 'EN']
            out['children'] = en_children
            if not any(x.get('tag') == 'STRING' and x.get('attributes',{}).get('LANG') == 'EN'
                       for x in value['children']):
                out['englishAbsent'] = True
            return out
        if value and set(value).issubset({'EN', 'PL', 'DE', 'CS', 'JP', 'FR', 'ES', 'IT', 'RU', 'und'}):
            return {'EN': value['EN']} if 'EN' in value else dict(EN_ABSENT)
        return {k: english_only(v) for k,v in value.items()}
    if isinstance(value, list):
        return [english_only(v) for v in value]
    return value


def optimized_library(parsed):
    """Columnar, deduplicated, losslessly recoverable normalized representation.

    Schema rows are arrays. Strings, GUIDs and translated text use a shared string pool.
    Missing is JSON null; explicitly empty cells are the empty string.
    """
    # The source tree is normalized first, then EN presentation is pruned. All
    # technical references are extracted BEFORE losing translations.
    import copy
    source = copy.deepcopy(parsed)
    source.pop('notes', None)
    tech_ids = set(source.get('technologies', {}))

    def technology_refs(value):
        found = set()
        if isinstance(value, str) and value in tech_ids:
            found.add(value)
        elif isinstance(value, dict):
            for x in value.values():
                found.update(technology_refs(x))
        elif isinstance(value, list):
            for x in value:
                found.update(technology_refs(x))
        return found

    for table in source['specifications'].values():
        rows = table.pop('rows', [])
        storages = table.pop('columnStorage', [])
        tech_refs = technology_refs(storages) | technology_refs(rows)
        ncols = max(len(storages), len(table.get('columns', [])))
        columns = []
        for ci in range(ncols):
            st = storages[ci] if ci < len(storages) else {}
            vals = [r[ci] if ci < len(r) else None for r in rows]
            # Preserve strings by reference to dictionary only when it saves space.
            uniques=[]; lookup={}; refs=[]
            for value in vals:
                token=json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
                if token not in lookup:
                    lookup[token]=len(uniques); uniques.append(value)
                refs.append(lookup[token])
            regular=json.dumps(vals, ensure_ascii=False, separators=(',', ':'))
            mapped=json.dumps([uniques, refs], ensure_ascii=False, separators=(',', ':'))
            representation= ['dict', uniques, refs] if len(mapped)+7 < len(regular) else ['plain', vals]
            columnmeta={k:v for k,v in st.items() if k not in ('rawValues','rawValueNodes', 'dictionary','valueMap')}
            # TYPE=6 uses a single dictionary+row-indices representation, not
            # a second dictionary / VALUE_MAP copy in metadata.
            original_dictionary=st.get('dictionary')
            value_map=st.get('valueMap')
            if st.get('typeCode')==6 and original_dictionary is not None:
                translated=[english_cell(x) for x in original_dictionary]
                map_indices=(value_map if value_map is not None else
                             list(range(len(translated))) if len(translated)==len(vals) else None)
                if (map_indices is not None and len(map_indices)==len(vals) and
                    all(isinstance(i,int) and 0<=i<len(translated) for i in map_indices) and
                    all(translated[i]==v for i,v in zip(map_indices, vals))):
                    representation=['dict',translated,map_indices]
                else:
                    # Preserve unrepresented original dictionary entries once
                    # (not a second copy of the full row data).
                    columnmeta['unresolvedDictionary']=original_dictionary
                    if value_map is not None:columnmeta['unresolvedValueMap']=value_map
            columns.append([representation, columnmeta])
        table['dataColumns']=columns
        # original technical technology IDs remain resolvable after display pruning
        if tech_refs:
            table['technologyRefs'] = sorted(tech_refs)
        table.pop('rawNames', None)  # columnNamesI18n is the canonical names
        table.get('metadata',{}).pop('producerGuidRaw',None)
        table.pop('raw',None) if table.get('dataColumns') else None
    for entity in source['entities'].values():
        raw_meta=entity.pop('metadataRaw',None)
        if raw_meta:
            unknown=[x for x in raw_meta if x.get('tag') not in ('GUID','VERSION','LEGACY_IDS','GROUP_TYPE')]
            if unknown:entity['unknownRootXml']=unknown
        prop=entity.pop('entityPropertiesRaw',None)
        if prop:
            if prop.get('attributes'):entity['entityPropertyAttributes']=prop['attributes']
            extras=[c for c in prop.get('children',[]) if c.get('tag') not in ('MLSTRING','PATH')]
            if extras:entity['entityPropertiesExtra']=extras
        for var in entity.get('variables',[]):
            var.pop('rawOptionList',None)
            # labelsAll can include non-CAPTION definitions, so never delete it without validation.
            for opt in var.get('options',[]):
                opt.pop('raw',None)
        for conn in entity.get('connectors',[]):
            # fields, expression and attributes contain all modeled data, but other XML
            # nodes might not be. Preserve unknown subnodes only.
            raw=conn.pop('raw',None)
            if raw:
                known={'POSTION','POSITION','FDIAM','DEF_TECHID','DEF_LINKTYPE', 'MLSTRING'}
                extra=[x for x in raw.get('children',[]) if x.get('tag') not in known and
                       not x.get('tag','').startswith('CND_') and x.get('tag') not in conn.get('fields',{})]
                if extra: conn['unknownXml']=extra
    for tech in source['technologies'].values():
        raw=tech.pop('raw',None)
        if raw:
            # retain version and producer/legacy IDs not present in older normalized structure
            tech['version']=next((x for x in raw['children'] if x['tag']=='VERSION'),None)
            tech['producerGuid']=next((x['text'] for x in raw['children'] if x['tag']=='GUID' and x['attributes'].get('NAME')=='PROD_GUID'),None)
            tech['legacyIds']=[x['attributes'] for box in raw['children'] if box['tag']=='LEGACY_IDS' for x in box['children']]
            extra=[x for x in raw['children'] if x['tag'] not in ('GUID','VERSION','LEGACY_IDS','PIPING_TECH','TABLES')]
            if extra:tech['unknownXml']=extra
    for folder in source['folders']:
        raw=folder.pop('raw',None)
        if raw:
            folder['version']=next((x for x in raw['children'] if x['tag']=='VERSION'),None)
            folder['producerGuid']=next((x['text'] for x in raw['children'] if x['tag']=='GUID' and x['attributes'].get('NAME')=='PROD_GUID'),None)
    source = english_only(source)
    source['schemaVersion']='2.1-columnar-en'
    source['storageSemantics']={'emptyCell':'','missingCell':None,
         'englishAbsent':dict(EN_ABSENT),
         'columnLayout':'dataColumns[i] = [ [plain, values] | [dict, dictionary, rowIndices], columnMetadata ]',
         'schemaEncoding':'object key and string dictionaries stored in packed document'}
    return source


def _packed_encoder(document):
    """Encode repeated object layouts as record arrays; intern repeated string values.
    Non-object lists are tagged only if they could collide with the record marker.
    """
    from collections import Counter
    string_counts=Counter()
    object_schemas=Counter()
    def scan(value):
        if isinstance(value,dict):
            object_schemas[tuple(value.keys())]+=1
            for val in value.values():scan(val)
        elif isinstance(value,list):
            for item in value:scan(item)
        elif isinstance(value,str):string_counts[value]+=1
    scan(document)
    # JSON quoting ensures the exact original string can be recovered.
    frequent=sorted((v for v,n in string_counts.items() if n>1 and
        n*(len(json.dumps(v,ensure_ascii=False))-5)>len(json.dumps(v,ensure_ascii=False))+4))
    dictionary={s:i for i,s in enumerate(frequent)}
    schemas=sorted((schema for schema,count in object_schemas.items() if count>1 and len(schema)>0),key=str)
    schema_ids={schema:i for i,schema in enumerate(schemas)}
    def encode(value):
        if isinstance(value,str):
            if value in dictionary:return ['$',dictionary[value]]
            return value
        if isinstance(value,dict):
            schema=tuple(value.keys())
            if schema in schema_ids:return ['#',schema_ids[schema],*[encode(v) for v in value.values()]]
            return {k:encode(v) for k,v in value.items()}
        if isinstance(value,list):
            encoded = [encode(v) for v in value]
            # '$', '#' and '~' are reserved packed-record markers in v2.1.
            # Escape literal arrays beginning with these strings, recursively.
            return ['~', encoded] if value and value[0] in ('$', '#', '~') else encoded
        return value
    return {'format':'FLM-PACK-1','schemaVersion':'2.1',
            'strings':frequent,'recordLayouts':[list(k) for k in schemas],
            'library':encode(document)}


def unpack_library(packed):
    strings=packed['strings']; schemas=packed['recordLayouts']
    version = str(packed.get('schemaVersion'))
    if packed.get('format') != 'FLM-PACK-1' or version not in ('2.0','2.1'):
        raise ValueError('Unsupported packed FLM format/version')
    def decode(x):
        if isinstance(x,list):
            if x and x[0]=='$':
                if len(x)!=2 or type(x[1]) is not int or not 0<=x[1]<len(strings):
                    raise ValueError('Invalid packed string reference')
                return strings[x[1]]
            if x and x[0]=='#':
                if len(x)<2 or type(x[1]) is not int or not 0<=x[1]<len(schemas):
                    raise ValueError('Invalid packed object schema reference')
                keys=schemas[x[1]]
                if len(x)-2!=len(keys):
                    raise ValueError('Packed object record length mismatch')
                return dict(zip(keys, (decode(v) for v in x[2:])))
            if version=='2.1' and x and x[0]=='~':
                if len(x)!=2 or not isinstance(x[1],list):
                    raise ValueError('Invalid packed literal array')
                return [decode(v) for v in x[1]]
            return [decode(v) for v in x]
        if isinstance(x,dict):return {k:decode(v) for k,v in x.items()}
        return x
    return decode(packed['library'])


def validate_optimized(source, packed, original=None):
    restored=unpack_library(packed)
    if restored != source:
        raise ValueError('Packing round-trip failed: normalized JSON changed')
    for table in restored['specifications'].values():
        arrays=table.get('dataColumns',[])
        n=table.get('arrayAttributes',{}).get('COLS',0)
        if len(arrays) != len(table.get('columns', [])):
            raise ValueError(f"{table.get('guid')}: data column/name count mismatch")
        if not isinstance(n,int) or n<0:
            raise ValueError(f"{table.get('guid')}: invalid row count {n!r}")
        for i,(storage,meta) in enumerate(arrays):
            if storage[0] not in ('plain','dict'):
                raise ValueError(f"{table.get('guid')}: invalid storage {storage[0]!r}")
            if storage[0]=='dict' and any(type(j) is not int or j<0 or j>=len(storage[1]) for j in storage[2]):
                raise ValueError(f"{table.get('guid')}: invalid dictionary index in column {i}")
            values=(storage[1] if storage[0]=='plain' else [storage[1][j] for j in storage[2]])
            if len(values)!=n:
                raise ValueError(f"{table.get('guid')}: column {i} has {len(values)} cells; expected {n}")
            if 'valueMap' in meta and meta.get('dictionary'):
                if len(meta['valueMap'])!=n:
                    raise ValueError(f"{table.get('guid')}: VALUE_MAP length mismatch")
    if original is not None:
        # Compare every normalized table cell, ID, restriction binding, and option.
        for table_guid, table in original['specifications'].items():
            out=restored['specifications'][table_guid]
            rebuilt=list(zip(*[(col[0][1] if col[0][0]=='plain' else
                                [col[0][1][k] for k in col[0][2]])
                               for col in out['dataColumns']])) if out['dataColumns'] else []
            rebuilt=[list(row) for row in rebuilt]
            if rebuilt!=table.get('rows',[]):
                raise ValueError(f'{table_guid}: table-cell round trip differs')
            for field in ('guid','producerGuid','legacyIds','columns','columnNamesI18n','arrayAttributes'):
                if out.get(field)!= (english_only(table.get(field)) if field=='columnNamesI18n' else table.get(field)):
                    raise ValueError(f'{table_guid}: {field} differs')
        for eid,ent in original['entities'].items():
            restored_ent=restored['entities'][eid]
            # Verify every connector's canonical labels survive removal of raw XML.
            if len(ent.get('connectors', [])) != len(restored_ent.get('connectors', [])):
                raise ValueError(f'{eid}: connector count differs')
            for old_conn, new_conn in zip(ent.get('connectors', []), restored_ent.get('connectors', [])):
                for field in ('id', 'key', 'attributes', 'positionExpressions',
                              'technologyRef', 'technologyRefIssue', 'externalTechnologyRef',
                              'technologyVariableRef', 'technologyResolution', 'fieldSequence',
                              'conditionSequence',
                              'diameterExpression', 'technologyExpression',
                              'connectionTypeExpression', 'conditionsRaw', 'labels', 'fields'):
                    if (english_only(old_conn.get(field)) if field == 'labels' else old_conn.get(field)) != new_conn.get(field):
                        raise ValueError(f'{eid}: connector {old_conn.get("id")} {field} differs')
                if 'MLSTRING' in new_conn.get('fields', {}):
                    raise ValueError(f'{eid}: connector label copied into scalar fields')
                if any(n.get('tag') == 'MLSTRING' for n in new_conn.get('unknownXml', [])):
                    raise ValueError(f'{eid}: duplicated connector labels in unknownXml')
            for field in ('guid','producerGuid','legacyIds','variables','restrictions','tableRefs',
                          'geometry','subElements','otherDefinitionFields','initialValuesRaw'):
                if field == 'variables':
                    if len(ent[field]) != len(restored_ent[field]):
                        raise ValueError(f'{eid}: variable count differs')
                    for a, b in zip(ent[field], restored_ent[field]):
                        for k in ('id', 'key', 'valueTypeCode', 'variableTypeCode',
                                  'defaultValues', 'options', 'visible', 'properties',
                                   'rawAttributes', 'visibilityHint', 'optionListAttributes',
                                   'optionListExtra', 'defaultValuesRaw', 'propertySequence'):
                            if k == 'options':
                                # The optimized schema intentionally drops each OPTION_PAIR's
                                # duplicate raw XML and non-English display translations.
                                # Compare the canonical English options on BOTH sides; do not
                                # skip the check or compare raw XML against compact records.
                                expected = [english_only({key: value for key, value in option.items()
                                                          if key != 'raw'})
                                            for option in a.get('options', [])]
                            else:
                                expected = english_only(a.get(k))
                            if expected != b.get(k):
                                raise ValueError(f'{eid}: variable {a.get("id")} {k} differs')
                elif english_only(ent.get(field)) != restored_ent.get(field):
                    raise ValueError(f'{eid}: {field} differs')
    return True



# -----------------------------------------------------------------------------
# In-file Graph Compiler & Solver (formerly flm_constraint_runtime.py)
# -----------------------------------------------------------------------------
IDENT = re.compile(r'(?<![\w.])%?([A-Za-z_][A-Za-z_0-9]*(?:\.[A-Za-z_][A-Za-z_0-9]*)*)')
SUPPORTED_OPS = {'eq', 'ne', 'lt', 'le', 'gt', 'ge'}


def _decode_value(packed, value):
    if isinstance(value, list):
        if value and value[0] == '$':
            if len(value)!=2 or type(value[1]) is not int or not 0<=value[1]<len(packed['strings']):
                raise ValueError('Invalid packed string reference')
            return packed['strings'][value[1]]
        if value and value[0] == '#':
            if len(value)<2 or type(value[1]) is not int or not 0<=value[1]<len(packed['recordLayouts']):
                raise ValueError('Invalid packed record reference')
            keys = packed['recordLayouts'][value[1]]
            if len(keys) != len(value) - 2:
                raise ValueError('Invalid packed record layout')
            return {key: _decode_value(packed, v) for key, v in zip(keys, value[2:])}
        if packed.get('schemaVersion')=='2.1' and value and value[0]=='~':
            if len(value)!=2 or not isinstance(value[1],list):
                raise ValueError('Invalid packed literal array')
            return [_decode_value(packed,v) for v in value[1]]
        return [_decode_value(packed, v) for v in value]
    if isinstance(value, dict):
        return {k: _decode_value(packed, v) for k, v in value.items()}
    return value


def _field(packed, obj, key):
    """Select one packed object field without unpacking its siblings."""
    if isinstance(obj, dict):
        return obj.get(key)
    if isinstance(obj, list) and len(obj) >= 2 and obj[0] == '#':
        schema = packed['recordLayouts'][obj[1]]
        return obj[2 + schema.index(key)] if key in schema else None
    raise ValueError('Expected packed object')


class LazyLibrary:
    """Load compressed JSON once; expand only requested entity and referenced tables."""
    def __init__(self, file_or_payload):
        self.packed = (json.loads(Path(file_or_payload).read_text(encoding='utf8'))
                       if isinstance(file_or_payload, (str, Path)) else file_or_payload)
        if self.packed.get('format') != 'FLM-PACK-1' or str(self.packed.get('schemaVersion')) not in ('2.0','2.1'):
            raise ValueError('Expected FLM-PACK-1 JSON schema 2.0/2.1. Export with --optimize.')
        self.body = self.packed['library']
        self._tables = {}
        self._entities = {}

    def section(self, name):
        raw = _field(self.packed, self.body, name)
        if isinstance(raw, dict):
            return raw
        # In FLM-PACK-1, two top-level sections can share the same set of
        # object keys (e.g. 'entities' and 'constraintGraphs'). The encoder
        # then stores both as packed object RECORDS, not ordinary dicts.
        # Decode only the SECTION index here; its entity/table bodies remain
        # lazily encoded until entity() / table() requests a specific item.
        if isinstance(raw, list) and len(raw) >= 2 and raw[0] == '#':
            index = raw[1]
            schemas = self.packed['recordLayouts']
            if type(index) is int and 0 <= index < len(schemas):
                keys = schemas[index]
                if len(keys) == len(raw)-2:
                    return dict(zip(keys,raw[2:]))
        raise ValueError(f'No library section {name}')

    def entity(self, key):
        raw_entities = self.section('entities')
        if key not in raw_entities:
            possible = [x for x in raw_entities if x == key or x.startswith(key + '@')]
            if len(possible) != 1:
                raise KeyError(f'Entity {key!r} missing or ambiguous: {possible}')
            key = possible[0]
        if key not in self._entities:
            self._entities[key] = _decode_value(self.packed, raw_entities[key])
        return key, self._entities[key]

    def table(self, guid):
        if guid not in self._tables:
            raw = self.section('specifications').get(guid)
            if raw is None:
                return None
            self._tables[guid] = _decode_value(self.packed, raw)
        return self._tables[guid]

    def technology(self, tech_id):
        value = self.section('technologies').get(tech_id)
        return _decode_value(self.packed, value) if value is not None else None


def _column(table, index):
    storage = table['dataColumns'][index][0]
    if storage[0] == 'plain':
        return storage[1]
    if storage[0] == 'dict':
        dictionary, refs = storage[1:3]
        return [dictionary[i] for i in refs]
    raise ValueError('Unsupported column storage ' + repr(storage[0]))


def _token(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def _is_unknown(value):
    return value is None or (isinstance(value, dict) and value.get('_enAbsent') is True)


def _is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _compatible(a, b):
    # A typed value comparison; string identifiers never equal numeric values.
    return (a == b and type(a) is type(b)) or (_is_number(a) and _is_number(b) and a == b)


def _compare(a, b, operation):
    if operation == 'eq':
        return _compatible(a, b)
    if operation == 'ne':
        return not _compatible(a, b)
    if (_is_number(a) and _is_number(b)) or (isinstance(a, str) and isinstance(b, str)):
        return {'lt': lambda: a < b, 'le': lambda: a <= b,
                'gt': lambda: a > b, 'ge': lambda: a >= b}[operation]()
    raise TypeError(f'Cannot compare {type(a)} with {type(b)}')


def _expression_inputs(expr, variable_names):
    if not isinstance(expr, str):
        return []
    return sorted(set(IDENT.findall(expr)) & set(variable_names))


def _evaluate(expr, values):
    """Safe one-way arithmetic/geometry evaluator. No arbitrary Python execution."""
    import math
    # GeometryPreview expressions.ts uses DEGREES, unlike math.sin/cos/tan.
    def cot_degrees(x):
        t=math.tan(math.radians(x))
        if abs(t)<1e-12:raise ZeroDivisionError('cot is undefined')
        return 1.0/t
    permitted = {'sin': lambda x: math.sin(math.radians(x)),
                 'cos': lambda x: math.cos(math.radians(x)),
                 'tan': lambda x: math.tan(math.radians(x)),
                 'cot': cot_degrees,
                 'sqrt': math.sqrt, 'abs': abs, 'mod': abs, 'min': min, 'max': max,
                  'pow': math.pow, 'floor': math.floor, 'ceil': math.ceil,
                  'round': round, 'exp': math.exp, 'log': math.log,
                  'asin': lambda x: math.degrees(math.asin(x)),
                  'acos': lambda x: math.degrees(math.acos(x)),
                  'atan': lambda x: math.degrees(math.atan(x))}
    # Python AST represents dotted FLM identifiers as attribute access. Rewrite
    # only *declared* dotted variables to safe identifiers, never evaluate attributes.
    formula = expr.lstrip('%').replace('^','**').replace('[','(').replace(']',')')
    environment = dict(values)
    for i, name in enumerate(sorted((k for k in values if '.' in k),key=len,reverse=True)):
        alias = f'__flm_dotted_{i}'
        pattern = r'(?<![\w.])' + re.escape(name) + r'(?![\w.])'
        formula, number = re.subn(pattern, alias, formula)
        if number:
            environment[alias] = values[name]
    tree = ast.parse(formula, mode='eval')
    def walk(n):
        if isinstance(n, ast.Expression):
            return walk(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float, str)):
            return n.value
        if isinstance(n, ast.Name) and n.id in environment:
            return environment[n.id]
        if isinstance(n, ast.Name) and n.id=='pi':
            return math.pi
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            return -walk(n.operand) if isinstance(n.op, ast.USub) else +walk(n.operand)
        if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            a, b = walk(n.left), walk(n.right)
            if isinstance(n.op, ast.Add): return a + b
            if isinstance(n.op, ast.Sub): return a - b
            if isinstance(n.op, ast.Mult): return a * b
            if isinstance(n.op, ast.Pow): return a ** b
            return a / b
        if (isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
                and n.func.id in permitted and not n.keywords):
            return permitted[n.func.id](*(walk(x) for x in n.args))
        raise ValueError('Unsupported formula syntax')
    return walk(tree)


def _conditions(raw):
    """Keep unknown opcodes intact, support both unnumbered and suffixed CND fields."""
    terms = []
    for key, val in raw.items():
        if key.startswith('CND_VAR'):
            suffix = key[7:]
            terms.append({'variable': val, 'relationCode': raw.get('CND_REL' + suffix),
                          'expected': raw.get('CND_VAL' + suffix), 'sourceKeys': [key, 'CND_REL'+suffix, 'CND_VAL'+suffix]})
    return terms


def _scope(entity_key, var):
    return f'element/{entity_key}/{var}'


class CompiledConstraintGraph:
    def __init__(self, library, entity_key, relation_codes=None, direction_hints=None, geometry_inputs=None, limit_relation_codes=None):
        self.library = library
        self.entity_key, self.entity = library.entity(entity_key)
        self.relation_codes = {int(k): v for k, v in (relation_codes or {}).items()}
        # LIMIT/RELATION is not CND_REL: do not infer their integer meanings.
        self.limit_relation_codes = {int(k):v for k,v in (limit_relation_codes or {}).items()}
        self.direction_hints = direction_hints or {}
        self.geometry_inputs = geometry_inputs  # Explicit native geometry input contract; None means unknown
        self.variables = {}
        self.factors = []
        self.by_id = {}
        self.var_factors = defaultdict(set)
        self.diagnostics = []
        self.super_graph = {}
        self.tables = {}
        self._compile()

    def _register(self, name, scope=None, definition=None):
        node = name if scope is None else f'{scope}/{name}'
        if node not in self.variables:
            self.variables[node] = {'id': node, 'scope': scope or '',
                                    'definition': definition or {}}
        return node

    def _factor(self, f):
        if f['id'] in self.by_id:
            raise ValueError('duplicate factor ' + f['id'])
        self.factors.append(f)
        self.by_id[f['id']] = f
        for v in f.get('variables', []) + f.get('activationVariables', []):
            self._register(v)
            self.var_factors[v].add(f['id'])

    def _cast_condition_value(self, c):
        # Explicit VAL_TYPE metadata, never a heuristic based on value spelling.
        meta = self.variables.get(c['node'],{}).get('definition',{})
        code=meta.get('valueTypeCode')
        value=c['expected']
        if isinstance(value,str):
            try:
                if code==1:c['expected']=int(value)
                elif code==2:c['expected']=float(value)
                elif code==3:c['expected']=value
            except ValueError:
                self.diagnostics.append({'code':'CONDITION_VALUE_TYPE_MISMATCH',
                                         'node':c['node'],'value':value,'typeCode':code})

    def _compile(self):
        eid = self.entity_key
        scope = f'element/{eid}'
        names = set()
        for variable in self.entity.get('variables', []):
            name = variable.get('id')
            if name:
                self._register(name, scope, {'visible': variable.get('visible'),
                                             'valueTypeCode': variable.get('valueTypeCode'),
                                             'defaults': variable.get('defaultValues', []),
                                             'options':variable.get('options', []),
                                             'properties':variable.get('properties', {})})
                names.add(name)
        for r in self.entity.get('restrictions', []):
            fid = f'restriction:{r["index"]}'
            var_bindings = []
            for binding in r.get('bindings', []):
                name = binding.get('variable')
                if name:
                    names.add(name)
                    var_bindings.append(dict(binding, node=_scope(eid, name)))
            cond = _conditions(r.get('conditionsRaw', {}))
            for c in cond:
                c['node'] = _scope(eid, c['variable'])
                names.add(c['variable'])
                self._cast_condition_value(c)
            guid = r.get('tableGuid')
            table = self.library.table(guid) if guid else None
            clauses=[]
            for extra in r.get('extraFields',[]):
                if extra.get('tag')!='LIMIT':continue
                attr=extra.get('attributes',{})
                target=attr.get('NAME')
                expr=attr.get('EXPRESSION')
                if not target or expr is None:continue
                deps=_expression_inputs(expr,names)
                # Detect references not in the declared variable definitions too.
                unknown_deps=[n for n in _expression_inputs(expr, IDENT.findall(expr))
                              if n not in names and n not in {'sin','cos','tan','cot','sqrt','abs','min','max'}]
                for name in unknown_deps:
                    self.diagnostics.append({'code':'UNDECLARED_LIMIT_INPUT','factor':fid,'variable':name,
                                             'severity':'warning','blocksSolve':False})
                clauses.append({'target':_scope(eid,target),'expression':expr,
                                'inputs':[_scope(eid,n) for n in sorted(set(deps+unknown_deps))],
                                'relationCode':attr.get('RELATION'),
                                'typeCode':attr.get('TYPE'),'source':extra})
            f = {'id': fid, 'kind': 'table' if table else ('limit' if clauses else 'unsupported'),
                 'tableGuid': guid, 'sourceRestriction': r, 'limitClauses':clauses,
                 'bindings': var_bindings, 'conditions': cond,
                 'variables': list(dict.fromkeys([b['node'] for b in var_bindings] +
                    [c['target'] for c in clauses] + [n for c in clauses for n in c['inputs']])),
                 'activationVariables': [c['node'] for c in cond]}
            if table:
                self.tables[guid] = table
                for b in var_bindings:
                    if not isinstance(b.get('columnKey'), int) or not (0 <= b['columnKey'] < len(table['dataColumns'])):
                        self.diagnostics.append({'code': 'COLUMN_SEMANTICS_UNVERIFIED',
                                                 'factor': fid, 'key': b.get('columnKey'),
                                                 'severity': 'info', 'blocksSolve': False})
                        f['kind'] = 'unsupported'
                        f['unsupportedReason'] = 'COLUMN_SEMANTICS_UNVERIFIED'
                if f['kind'] == 'table':
                    grouped = defaultdict(set)
                    for b in var_bindings:
                        grouped[b['node']].add(b['columnKey'])
                    if any(len(columns) > 1 for columns in grouped.values()):
                        # Do not assume each occurrence of VAR_NAME means an
                        # equality constraint: LEVEL and TYPE can change its role.
                        f['kind'] = 'unsupported'
                        f['unsupportedReason'] = 'MULTICOLUMN_BINDING_SEMANTICS_UNVERIFIED'
                if f['kind'] == 'table':
                    for b in var_bindings:
                        definition = self.variables.get(b['node'], {}).get('definition', {})
                        kind = definition.get('valueTypeCode')
                        if kind not in (1, 2, 3):
                            continue
                        source_values = [v for v in _column(table, b['columnKey'])
                                         if not _is_unknown(v)]
                        if not source_values:
                            continue
                        def matching_type(v):
                            if kind == 1:
                                return type(v) is int
                            if kind == 2:
                                return _is_number(v)
                            return isinstance(v, str)
                        if not any(matching_type(v) for v in source_values):
                            # TYPE and LEVEL may require a mapping/coercion table.
                            # Guessing otherwise generates false NO_VALID_ROWS.
                            f['kind'] = 'unsupported'
                            f['unsupportedReason'] = 'TABLE_COERCION_SEMANTICS_UNVERIFIED'
                            break
            elif not clauses:
                if guid and guid != '00000000-0000-0000-0000-000000000000':
                    code = 'MISSING_TABLE'
                elif guid and guid.startswith('00000000-'):
                    code = 'ZERO_GUID_REFERENCE'
                else:
                    code = 'UNSUPPORTED_RESTRICTION'
                f['unsupportedReason']=code
                self.diagnostics.append({'code': code, 'factor': fid, 'tableGuid': guid,
                                         'typeCode': r.get('typeCode'), 'source': r.get('extraFields'),
                                         'severity':'warning','blocksSolve':False})
            if r.get('conditionSequence') is not None:
                f['kind'] = 'unsupported'
                f['unsupportedReason'] = 'REPEATED_CONDITION_SEMANTICS_UNVERIFIED'
            self._factor(f)
        # Entity/TABLES is a library metadata reference list. It is not proof
        # that every referenced table is needed by this entity's active factors.
        # Warn on missing metadata links, but fail only when a used factor needs it.
        for index, table_guid in enumerate(self.entity.get('tableRefs', [])):
            if self.library.table(table_guid) is None:
                self.diagnostics.append({
                    'code': 'MISSING_DECLARED_TABLE_REF', 'tableGuid': table_guid,
                    'entity': eid, 'index': index, 'severity': 'warning',
                    'blocksSolve': False
                })
        for name in names:
            self._register(name, scope)
        # An optional sub-element is a separate variable namespace. Never bind a
        # same-named parent variable without an explicit cross-scope reference.
        for sub in self.entity.get('subElements', []):
            sid = sub.get('id')
            child_scope = f'subelement/{eid}/{sid}'
            for v in sub.get('variables', []):
                self._register(v['id'], child_scope, {'visible':v.get('visible'),
                    'valueTypeCode':v.get('valueTypeCode'),
                    'defaults':v.get('defaultValues',[]),
                    'options':v.get('options',[]),'properties':v.get('properties',{})})
            for r in sub.get('restrictions', []):
                fid = f'subelement:{sid}:restriction:{r["index"]}'
                bindings=[]
                for b in r.get('bindings', []):
                    if not b.get('variable'):continue
                    bindings.append(dict(b, node=f'{child_scope}/{b["variable"]}'))
                conditions=_conditions(r.get('conditionsRaw', {}))
                for c in conditions:c['node']=f'{child_scope}/{c["variable"]}'
                guid=r.get('tableGuid')
                table=self.library.table(guid) if guid else None
                factor={'id':fid,'kind':'table' if table else 'unsupported',
                        'tableGuid':guid,'sourceRestriction':r,'bindings':bindings,
                        'conditions':conditions,'variables':[b['node'] for b in bindings],
                        'activationVariables':[c['node'] for c in conditions]}
                if table:
                    self.tables[guid]=table
                    for b in bindings:
                        if not isinstance(b.get('columnKey'),int) or b['columnKey']>=len(table['dataColumns']):
                            factor['kind']='unsupported'
                            self.diagnostics.append({'code':'INVALID_SUBELEMENT_COLUMN','factor':fid})
                else:
                    self.diagnostics.append({'code':'UNSUPPORTED_SUBELEMENT_RESTRICTION',
                                             'factor':fid,'source':r})
                self._factor(factor)
            # Connector definitions scoped to sub-elements must not be silently
            # ignored if their expression language/parent bindings are unknown.
            for c in sub.get('connectors', []):
                self.diagnostics.append({'code':'SUBELEMENT_CONNECTOR_BINDING_UNVERIFIED',
                                         'subElement':sid,'connector':c.get('id')})
            if sub.get('unknownXml') or sub.get('parentBindingsRaw'):
                self.diagnostics.append({'code':'SUBELEMENT_BINDING_UNVERIFIED',
                                         'subElement':sid,
                                         'source':sub.get('unknownXml',[])+sub.get('parentBindingsRaw',[])})
            if sub.get('geometry') is not None:
                self.diagnostics.append({'code':'SUBELEMENT_GEOMETRY_CONTRACT_UNVERIFIED',
                                         'subElement':sid, 'source':sub['geometry']})
        # Connector scopes are separate; only explicit XML expressions create edges
        # to element vars. A constant DEF_TECHID creates a technology instance.
        for con in self.entity.get('connectors', []):
            cid = con.get('id') or con.get('key') or str(len(self.factors))
            cs = f'connector/{eid}/{cid}'
            expressions = dict(con.get('positionExpressions') or {})
            for field, key in [('diameter', 'diameterExpression'), ('technology', 'technologyExpression'),
                               ('connectionType', 'connectionTypeExpression')]:
                if con.get(key) is not None:
                    expressions[field] = con[key]
            for field, expr in expressions.items():
                tech_ref = con.get('technologyRef') if field == 'technology' else None
                if tech_ref:
                    # Stable ID already resolved against source XML aliases. Do
                    # not evaluate a localized technology name as a formula.
                    expr = tech_ref['id']
                deps = [_scope(eid, x) for x in _expression_inputs(expr, names)]
                output = self._register(field, cs)
                if field == 'technology' and con.get('technologyRefIssue'):
                    self.diagnostics.append(dict(con['technologyRefIssue'],
                        connector=cid, entity=eid, blocksSolve=True))
                if field == 'technology' and isinstance(expr, str) and not deps and not expr.startswith('%'):
                    tech = self.library.technology(expr)
                    if tech:
                        technology_node = self._register(
                            'definition', f'technology/{eid}/{cid}/{expr}',
                            {'id': expr, 'guid': tech.get('guid')})
                        size_name=tech.get('sizeTableName')
                        matches=[g for g in tech.get('tableRefs',[]) if
                                 self.library.table(g) is not None and self.library.table(g).get('id')==size_name]
                        if len(matches)!=1:
                            self.diagnostics.append({'code':'TECH_SIZE_TABLE_AMBIGUOUS_OR_MISSING',
                                'connector':cid,'technology':expr,'sizeTable':size_name,'matches':matches,
                                'severity':'warning','blocksSolve':False})
                        else:
                            t_guid=matches[0]
                            diameter=con.get('diameterExpression')
                            node=_scope(eid,diameter) if diameter in names else None
                            existing=[f for f in self.factors if f['kind']=='table' and
                                      f['tableGuid']==t_guid and node in f.get('variables',[])]
                            if existing:
                                # The restriction contains the exact XML bindings.
                                # Reference it; never guess that d3 == a column named d.
                                self._factor({'id':f'technology:{cid}:size',
                                    'kind':'technology-reference', 'technologyId':expr,
                                    'tableGuid':t_guid, 'referencedFactor':existing[0]['id'],
                                    'variables':[node, output, technology_node],
                                    'activationVariables':[],
                                    'source':'PIPING_TECH/SIZE_TABLE + DEF_LINK/FDIAM'})
                            else:
                                self.diagnostics.append({'code':'TECH_SIZE_BINDING_UNVERIFIED',
                                    'connector':cid,'technology':expr,'tableGuid':t_guid,
                                    'diameterExpression':diameter,'severity':'warning','blocksSolve':False})
                    else:
                        self.diagnostics.append({'code': 'UNKNOWN_TECHNOLOGY', 'connector': cid, 'value': expr,
                                                 'severity':'warning','blocksSolve':False})
                if not deps and expr is None:
                    continue
                formula_conditions=[dict(c,node=_scope(eid,c['variable']))
                                    for c in _conditions(con.get('conditionsRaw', {}))]
                for condition in formula_conditions:self._cast_condition_value(condition)
                self._factor({'id': f'connector:{cid}:{field}', 'kind': 'formula',
                              'sourceExpression': expr, 'inputs': deps, 'output': output,
                              'conditions':formula_conditions,
                              'variables': deps + [output],
                              'activationVariables': [c['node'] for c in formula_conditions]})
            conditions = _conditions(con.get('conditionsRaw', {}))
            if conditions:
                for item in conditions:
                    item['node'] = _scope(eid, item['variable'])
                    self._cast_condition_value(item)
                self._factor({'id': f'connector:{cid}:activation', 'kind': 'activation',
                              'conditions': conditions, 'variables': [],
                              'activationVariables': [c['node'] for c in conditions]})
        self._make_supergraph()

    def _make_supergraph(self):
        """Factor groups, with explicit directional formula edges and undirected joins.

        Do NOT invent a table ordering from LEVEL/typeCodes. Optional verified
        direction hints may turn a table's factor connections into directed edges.
        """
        joins, directs = [], []
        for variable, ids in self.var_factors.items():
            relevant = sorted(ids)
            for a_i, a in enumerate(relevant):
                for b in relevant[a_i + 1:]:
                    # If one factor emits this variable and the other consumes it,
                    # the connecting dependency can be directed.
                    fa, fb = self.by_id[a], self.by_id[b]
                    a_out = (fa.get('output') == variable or
                             variable in self.direction_hints.get(a, {}).get('outputs', []))
                    b_out = (fb.get('output') == variable or
                             variable in self.direction_hints.get(b, {}).get('outputs', []))
                    if a_out != b_out:
                        directs.append({'from': a if a_out else b, 'to': b if a_out else a,
                                        'variable': variable})
                    else:
                        joins.append({'a': a, 'b': b, 'variable': variable,
                                      'direction': 'bidirectional/unknown'})
        for f in self.factors:
            for c in f.get('conditions', []):
                node = c['node']
                for producer in self.var_factors.get(node, []):
                    if producer != f['id'] and self.by_id[producer].get('output') == node:
                        directs.append({'from': producer, 'to': f['id'], 'variable': node})
        # Unknown/bidirectional joins are simultaneous solve requirements.
        # Merge these factor regions BEFORE calculating directed SCCs. Otherwise
        # a shared relational variable incorrectly appears as independent groups.
        parent = {f['id']: f['id'] for f in self.factors}
        def root(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        def union(a, b):
            x, y = root(a), root(b)
            if x != y:
                parent[y] = x
        for edge in joins:
            union(edge['a'], edge['b'])
        members = defaultdict(set)
        for fid in parent:
            members[root(fid)].add(fid)

        # Directed cyclic dependencies across joined regions are also solved
        # together; nothing is inferred from undocumented LEVEL codes.
        adjacency = defaultdict(set)
        for edge in directs:
            a, b = root(edge['from']), root(edge['to'])
            if a != b:
                adjacency[a].add(b)
        counter = [0]
        stack, in_stack, indices, lows, components = [], set(), {}, {}, []
        def visit(v):
            indices[v] = lows[v] = counter[0]
            counter[0] += 1
            stack.append(v)
            in_stack.add(v)
            for w in sorted(adjacency[v]):
                if w not in indices:
                    visit(w)
                    lows[v] = min(lows[v], lows[w])
                elif w in in_stack:
                    lows[v] = min(lows[v], indices[w])
            if lows[v] == indices[v]:
                roots = []
                while True:
                    w = stack.pop()
                    in_stack.remove(w)
                    roots.append(w)
                    if w == v:
                        break
                components.append(sorted(fid for one in roots for fid in members[one]))
        for block in sorted(members):
            if block not in indices:
                visit(block)
        components.sort(key=lambda x: x[0] if x else '')
        component_id = {fid:i for i,group in enumerate(components) for fid in group}
        group_links = set()
        for edge in directs:
            a, b = component_id[edge['from']], component_id[edge['to']]
            if a != b:
                group_links.add((a,b))
        # Partial directed group edges are reliable even if the global order
        # cannot be proven. When any undirected relation remains, solve with the
        # propagation worklist rather than fabricating a topological plan.
        order = None
        if not joins:
            indegree = [0] * len(components)
            forward = defaultdict(set)
            for a,b in group_links:
                if b not in forward[a]:
                    forward[a].add(b)
                    indegree[b] += 1
            queue = deque(i for i,degree in enumerate(indegree) if degree == 0)
            result_order = []
            while queue:
                i = queue.popleft()
                result_order.append(i)
                for j in sorted(forward[i]):
                    indegree[j] -= 1
                    if indegree[j] == 0:
                        queue.append(j)
            if len(result_order) == len(components):
                order = result_order
        self.super_graph = {
            'groups': [{'id': f'G{i}', 'factorIds': component}
                       for i,component in enumerate(components)],
            'directedEdges': directs,
            'groupEdges': [{'from':f'G{a}', 'to':f'G{b}'}
                           for a,b in sorted(group_links)],
            'unknownDirectionJoins': joins,
            'solveOrder': [f'G{i}' for i in order] if order is not None else None,
            'mode': 'verified-direction' if order is not None else 'bidirectional-worklist'
        }

    def summary(self):
        return {'entityKey': self.entity_key,
                'variableNodes': list(self.variables), 'factors': self.factors,
                'superGraph': self.super_graph, 'diagnostics': self.diagnostics}


class UnifiedConstraintSolver:
    def __init__(self, graph, max_search_nodes=30000):
        self.graph = graph
        self.max_search_nodes = max_search_nodes
        self._index = {}
        self._values = {}
        self._previous = None
        self._last_valid_snapshot = None
        self._previous_pins = {}
        self._component_cache = {}

    def _column_values(self,guid,col):
        k=(guid,col)
        if k not in self._values:self._values[k]=_column(self.graph.tables[guid],col)
        return self._values[k]

    def _column_index(self, guid, col):
        k=(guid,col)
        if k not in self._index:
            index=defaultdict(set)
            for i,v in enumerate(self._column_values(guid,col)):
                if not _is_unknown(v):index[_token(v)].add(i)
            self._index[k]=index
        return self._index[k]

    def _matching_rows(self, guid, col, val):
        index=self._column_index(guid,col)
        values=set(index.get(_token(val),()))
        if _is_number(val):
            values.update(index.get(_token(float(val)),()))
            if float(val).is_integer():values.update(index.get(_token(int(val)),()))
        return values

    def _active(self, f, domains):
        for c in f.get('conditions', []):
            op = self.graph.relation_codes.get(c['relationCode'])
            if op not in SUPPORTED_OPS:
                return None, {'code': 'UNVERIFIED_CONDITION', 'factor': f['id'], 'condition': c}
            values = domains.get(c['node'])
            if values is None or not values:
                return None, {'code': 'UNRESOLVED_ACTIVATION', 'factor': f['id'], 'condition': c}
            outcomes = {_compare(v, c['expected'], op) for v in values.values() if not _is_unknown(v)}
            if not outcomes:
                return None, {'code': 'UNRESOLVED_ACTIVATION', 'factor': f['id'], 'condition': c}
            if outcomes == {False}:return False,None
            if outcomes != {True}:
                return None, {'code': 'AMBIGUOUS_ACTIVATION', 'factor': f['id'], 'condition': c}
        return True,None

    def _eligible_rows(self, f, domains):
        guid=f['tableGuid'];table=self.graph.tables[guid]
        rows=set(range(int(table.get('arrayAttributes',{}).get('COLS',0))))
        for b in f['bindings']:
            k=b['columnKey'];node=b['node']
            allowed=domains.get(node)
            if allowed is None:continue
            candidates=set()
            for v in allowed.values():
                candidates.update(self._matching_rows(guid,k,v))
            rows.intersection_update(candidates)
            if not rows:break
        return rows

    def _validate_value(self, node, value):
        definition=self.graph.variables.get(node,{}).get('definition',{})
        code=definition.get('valueTypeCode')
        if code not in (1,2,3):
            return {'code':'VARIABLE_TYPE_UNVERIFIED','variable':node,'value':value,
                    'typeCode':code}
        if code==1 and (type(value) is not int):
            return {'code':'INVALID_VARIABLE_TYPE','variable':node,'value':value,'expected':'integer'}
        if code==2 and not _is_number(value):
            return {'code':'INVALID_VARIABLE_TYPE','variable':node,'value':value,'expected':'real'}
        if code==3 and not isinstance(value,str):
            return {'code':'INVALID_VARIABLE_TYPE','variable':node,'value':value,'expected':'string'}
        opts=definition.get('options') or []
        if opts and not any(_compatible(value,option.get('value')) for option in opts):
            return {'code':'VALUE_NOT_IN_OPTION_LIST','variable':node,'value':value}
        props=definition.get('properties') or {}
        low,high=props.get('MIN_VALUE'),props.get('MAX_VALUE')
        # MIN=MAX=0 is the XML's common unspecified range placeholder.
        if _is_number(value) and not (low==0 and high==0):
            if _is_number(low) and value<low or _is_number(high) and value>high:
                return {'code':'VALUE_OUT_OF_RANGE','variable':node,'value':value,
                        'min':low,'max':high}
        return None

    def _initial_domains(self, pins):
        domains = {}
        for factor in self.graph.factors:
            if factor['kind']!='table':continue
            for b in factor['bindings']:
                node=b['node']; vals=self._column_values(factor['tableGuid'],b['columnKey'])
                avail=domains.setdefault(node,{})
                for value in vals:
                    if (not _is_unknown(value) and
                        self._validate_value(node,value) is None):
                        avail[_token(value)]=value
        # Explicit OPTION_LISTs are constraints, including for standalone vars.
        for node, entry in self.graph.variables.items():
            opts=entry.get('definition',{}).get('options') or []
            if not opts:continue
            allowed={_token(o['value']):o['value'] for o in opts}
            if node in domains:
                domains[node]={key:v for key,v in domains[node].items() if
                    any(_compatible(v,x) for x in allowed.values())}
            else:domains[node]=allowed
        for node,value in pins.items():
            domains[node] = {_token(value):value}
        return domains

    def _limit_check(self, factor, domains, assignment=None):
        """Enforce a LIMIT only with an explicitly verified relation opcode.

        A missing dependency leaves a constraint pending, never silently valid.
        """
        assignment=assignment or {}
        pending=False
        for clause in factor.get('limitClauses',[]):
            raw=clause.get('relationCode')
            try:code=int(raw)
            except (TypeError,ValueError):code=raw
            operation=self.graph.limit_relation_codes.get(code)
            if operation not in SUPPORTED_OPS:
                return None, {'code':'UNVERIFIED_LIMIT_RELATION','factor':factor['id'],
                              'relationCode':raw,'source':clause['source']}
            def sole(node):
                if node in assignment:return assignment[node]
                domain=domains.get(node)
                if domain and len(domain)==1:return next(iter(domain.values()))
                return None
            target=sole(clause['target'])
            inputs={node:sole(node) for node in clause['inputs']}
            if target is None or any(v is None for v in inputs.values()):
                pending=True;continue
            local={node.rsplit('/',1)[-1]:v for node,v in inputs.items()}
            try:reference=_evaluate(str(clause['expression']),local)
            except (ValueError,TypeError,ZeroDivisionError,SyntaxError,NameError) as exc:
                return None, {'code':'UNRESOLVED_LIMIT_EXPRESSION','factor':factor['id'],
                              'expression':clause['expression'],'reason':str(exc)}
            try:ok=_compare(target,reference,operation)
            except (TypeError,ValueError) as exc:
                return None, {'code':'LIMIT_COMPARISON_ERROR','factor':factor['id'],'reason':str(exc)}
            if not ok:
                return False, {'code':'LIMIT_VIOLATION','factor':factor['id'],
                              'variable':clause['target'],'actual':target,
                              'expression':clause['expression'],'expected':reference,'operation':operation}
        if pending:return None, {'code':'LIMIT_INPUT_UNRESOLVED','factor':factor['id']}
        return True,None

    def _propagate(self, domains, affected, diagnostics):
        active=[]; active_rows={};changed=True;rounds=0;pending=[]
        while changed:
            rounds+=1;changed=False;active=[];active_rows={};pending=[]
            if rounds>max(10, len(self.graph.factors)*8):
                diagnostics.append({'code':'PROPAGATION_NOT_CONVERGED'});break
            for f in self.graph.factors:
                if f['id'] not in affected:continue
                state,err=self._active(f,domains)
                if err:
                    if err not in pending:pending.append(err)
                    continue
                if not state:continue
                active.append(f['id'])
                if f['kind']=='unsupported':
                    issue={'code':f.get('unsupportedReason','UNSUPPORTED_RESTRICTION'),'factor':f['id']}
                    if issue not in pending:pending.append(issue)
                    continue
                if f['kind']=='limit':
                    ok,issue=self._limit_check(f,domains)
                    # May become decidable after table propagation converges.
                    if ok is False:
                        diagnostics.append(issue);return active,active_rows
                    if issue and issue not in pending:pending.append(issue)
                    continue
                if f['kind']!='table':continue
                rows=self._eligible_rows(f,domains)
                active_rows[f['id']]=rows
                if not rows:
                    diagnostics.append({'code':'NO_VALID_ROWS','factor':f['id'],
                                        'variables':[b['node'] for b in f['bindings']]})
                    return active,active_rows
                table=self.graph.tables[f['tableGuid']]
                for b in f['bindings']:
                    node=b['node'];column=self._column_values(f['tableGuid'],b['columnKey'])
                    support={_token(column[j]):column[j] for j in rows if j<len(column) and not _is_unknown(column[j])}
                    if any(j >= len(column) or _is_unknown(column[j]) for j in rows):
                        issue={'code':'MISSING_OR_UNTRANSLATED_CELL', 'factor':f['id'],'variable':node}
                        if issue not in pending:pending.append(issue)
                    if node not in domains:
                        domains[node]=support;changed=True
                    else:
                        intersection={k:v for k,v in domains[node].items() if k in support or
                                      any(_compatible(v, sv) for sv in support.values())}
                        if not intersection:
                            diagnostics.append({'code':'DOMAIN_EMPTY','factor':f['id'],'variable':node})
                            return active,active_rows
                        if len(intersection)<len(domains[node]):
                            domains[node]=intersection;changed=True
        diagnostics.extend(x for x in pending if x not in diagnostics)
        return active,active_rows

    def _check_assignment(self, values, factor_ids):
        for fid in factor_ids:
            f=self.graph.by_id[fid]
            if f['kind']!='table':continue
            table=self.graph.tables[f['tableGuid']]
            rows=set(range(int(table['arrayAttributes']['COLS'])))
            for b in f['bindings']:
                if b['node'] not in values:continue
                needle=values[b['node']]
                rows.intersection_update(self._matching_rows(f['tableGuid'],b['columnKey'],needle))
                if not rows:return False
        return True

    def _exact_support(self, domains, factor_ids):
        """Exact relational support by joining FACTOR TUPLES, not variable products.

        Each active restriction contributes candidate rows from its projected
        DEF_ARGMAP columns. Joins share variable values and are performed inside
        coupled supernodes. Independent components are solved separately, so a
        1000 x 1000 x 1000 product of unrelated factors is never enumerated.

        Rows with missing/opaque bound cells are NOT invented as numeric values.
        An unhandled factor type is reported by the compiler, not silently added
        to this table search. Time budgets yield an unresolved result, never a
        falsely 'valid' partial support set.
        """
        factors = [self.graph.by_id[fid] for fid in factor_ids]
        if not factors:
            return {}, 1, True
        parent = {f['id']: f['id'] for f in factors}

        def find(fid):
            while parent[fid] != fid:
                parent[fid] = parent[parent[fid]]
                fid = parent[fid]
            return fid

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        # First respect proven simultaneous groups from the conservative Python
        # runtime graph. A second join by shared bound variable is mandatory:
        # even future directional optimization cannot drop relational coupling.
        active = set(parent)
        for group in self.graph.super_graph.get('groups', []):
            members = [fid for fid in group.get('factorIds', []) if fid in active]
            for fid in members[1:]:
                union(members[0], fid)
        bound_by = {}
        for f in factors:
            for binding in f['bindings']:
                node = binding['node']
                if node in bound_by:
                    union(bound_by[node], f['id'])
                else:
                    bound_by[node] = f['id']
        components = defaultdict(list)
        for factor in factors:
            components[find(factor['id'])].append(factor)

        global_supported = {}
        solution_count = 1
        all_complete = True
        for component in components.values():
            group_ids = tuple(sorted(f['id'] for f in component))
            nodes = sorted({b['node'] for f in component for b in f['bindings']})
            cache_key = (group_ids, tuple((n, tuple(sorted(_token(value) for value in
                         domains.get(n, {}).values()))) for n in nodes))
            cached = self._component_cache.get(cache_key)
            if cached is not None:
                supported, count, complete = cached
            else:
                supported = {node:{} for node in nodes}
                factor_candidates = []
                complete = True
                for factor in component:
                    # Candidate row indices are already pruned by pinned domains.
                    rows = self._eligible_rows(factor, domains)
                    cols = [(b['node'], self._column_values(factor['tableGuid'],
                                                             b['columnKey']))
                            for b in factor['bindings']]
                    seen_assignments = set()
                    assignments = []
                    for row_index in sorted(rows):
                        assignment = {}
                        valid = True
                        for node, column in cols:
                            if row_index >= len(column) or _is_unknown(column[row_index]):
                                valid = False
                                break
                            value = column[row_index]
                            if node in assignment and not _compatible(assignment[node], value):
                                # The conservative compiler should already have
                                # reported multi-column role semantics unknown.
                                valid = False
                                break
                            assignment[node] = value
                        if not valid:
                            continue
                        identity = tuple((node,_token(value)) for node,value in sorted(assignment.items()))
                        if identity not in seen_assignments:
                            seen_assignments.add(identity)
                            assignments.append(assignment)
                    factor_candidates.append((factor['id'],assignments))
                # Most-selective factor first; this is relational row joining,
                # not Cartesian multiplication of all variable domains.
                factor_candidates.sort(key=lambda item:(len(item[1]),item[0]))
                visits = 0
                seen_solutions = set()
                count = 0

                def explore(position, assignment):
                    nonlocal visits, count
                    visits += 1
                    if visits > self.max_search_nodes:
                        raise TimeoutError()
                    if position == len(factor_candidates):
                        identity = tuple((node,_token(value)) for node,value in sorted(assignment.items()))
                        if identity in seen_solutions:
                            return
                        seen_solutions.add(identity)
                        count += 1
                        for node,value in assignment.items():
                            supported[node][_token(value)] = value
                        return
                    _, rows = factor_candidates[position]
                    for row in rows:
                        visits += 1
                        if visits > self.max_search_nodes:
                            raise TimeoutError()
                        if any(node in assignment and not _compatible(assignment[node], value)
                               for node,value in row.items()):
                            continue
                        changed = [node for node in row if node not in assignment]
                        for node in changed:
                            assignment[node] = row[node]
                        explore(position+1, assignment)
                        for node in changed:
                            del assignment[node]

                try:
                    explore(0, {})
                except TimeoutError:
                    complete = False
                if complete:
                    self._component_cache[cache_key] = (supported,count,True)
            for node, values in supported.items():
                if node in global_supported:
                    global_supported[node] = {k:v for k,v in global_supported[node].items()
                                              if k in values}
                else:
                    global_supported[node] = dict(values)
            solution_count = min(2, solution_count * count)
            if not complete:
                all_complete = False
        return global_supported, solution_count, all_complete


    def solve(self, changed=None, current=None):
        changed=changed or {};current=current or {}
        eid=self.graph.entity_key
        # Changes are a transaction PATCH: previous explicit selections persist.
        # Passing None releases a previous selection, rather than pinning JSON null.
        pins=dict(self._previous_pins)
        for k,v in changed.items():
            node=_scope(eid,k) if '/' not in k else k
            if v is None:pins.pop(node,None)
            else:pins[node]=v
        if self._previous is not None and pins==self._previous_pins:
            return dict(self._previous, affectedGroups=[])
        diagnostics=list(self.graph.diagnostics)
        for node,value in pins.items():
            if node not in self.graph.variables:
                diagnostics.append({'code':'UNKNOWN_VARIABLE','variable':node,'value':value})
            else:
                error=self._validate_value(node,value)
                if error:diagnostics.append(error)
        domains=self._initial_domains(pins)
        if self._previous is None:
            affected=set(self.graph.by_id)
        else:
            seeds={n for n in set(pins)|set(self._previous_pins) if pins.get(n)!=self._previous_pins.get(n)}
            affected=set();queue=deque(seeds);seen=set(seeds)
            while queue:
                n=queue.popleft()
                for fid in self.graph.var_factors.get(n,()):
                    if fid in affected:continue
                    affected.add(fid)
                    f=self.graph.by_id[fid]
                    for v in f.get('variables',[])+f.get('activationVariables',[]):
                        if v not in seen:seen.add(v);queue.append(v)
        # Reconstruct all domains for correctness (including pin release). Exact
        # search results are cached PER INDEPENDENT COMPONENT, keyed by domains.
        # affectedGroups is a dependency diagnostic; propagation is conservative.
        active,rows=self._propagate(domains,set(self.graph.by_id),diagnostics)
        active_table=[fid for fid in active if self.graph.by_id[fid]['kind']=='table']
        definite_errors=any(d['code'] in ('NO_VALID_ROWS','DOMAIN_EMPTY',
            'INVALID_VARIABLE_TYPE','VALUE_NOT_IN_OPTION_LIST','VALUE_OUT_OF_RANGE',
            'UNKNOWN_VARIABLE','VARIABLE_TYPE_UNVERIFIED','LIMIT_VIOLATION') for d in diagnostics)
        incomplete=any(d['code'] not in ('NO_VALID_ROWS','DOMAIN_EMPTY')
                       and d.get('blocksSolve', True) for d in diagnostics)
        supported={};solution_count=0;complete=False
        if not definite_errors:
            supported,solution_count,complete=self._exact_support(domains,active_table)
            if not complete:diagnostics.append({'code':'SEARCH_BUDGET_EXCEEDED','limit':self.max_search_nodes})
        if definite_errors or (complete and solution_count==0):
            status='conflict'
        elif incomplete or not complete:
            status='unresolved'
        elif solution_count>1:
            status='ambiguous'
        else:
            status='valid'
        # Independent variables (unconstrained) remain input/default driven.
        resolved={}
        all_supported=dict(supported)
        for node, values in domains.items():
            if node not in all_supported:all_supported[node]=values
        for node,vals in all_supported.items():
            if len(vals)==1:resolved[node]=next(iter(vals.values()))
        for node,val in pins.items():
            if self._validate_value(node,val) is None:resolved[node]=val
        # Defaults of isolated variables are literal XML defaults, not inferred
        # table assignments. For ambiguous table-bound variables they are only
        # suggestions, never an implicit first-row selection.
        default_suggestions={}
        for node, entry in self.graph.variables.items():
            defs=entry.get('definition',{}).get('defaults',[])
            if not defs or len(defs)!=1:continue
            choice=defs[0]
            if node in all_supported:
                if any(_compatible(choice, v) for v in all_supported[node].values()):
                    default_suggestions[node]=choice
            elif node not in resolved and self._validate_value(node,choice) is None:
                resolved[node]=choice
        # Evaluate directed formulas only after a unique/sufficiently resolved input.
        if status in ('valid','ambiguous'):
            for f in self.graph.factors:
                if f['kind']!='formula':continue
                active_formula, activation_error = self._active(f, domains)
                if activation_error:
                    if activation_error not in diagnostics:diagnostics.append(activation_error)
                    status='unresolved'
                    continue
                if not active_formula:continue
                expr=f['sourceExpression']
                if not isinstance(expr,str):
                    resolved[f['output']]=expr;continue
                local={name:resolved[_scope(eid,name)] for name in
                       _expression_inputs(expr,[k.split('/')[-1] for k in self.graph.variables if k.startswith('element/')])
                       if _scope(eid,name) in resolved}
                if len(local)<len(f['inputs']):continue
                if expr.startswith('%') and expr[1:] in local:
                    resolved[f['output']]=local[expr[1:]]
                elif expr in local:
                    resolved[f['output']]=local[expr]
                elif not f['inputs'] and (f['id'].endswith(':technology') or
                                               f['id'].endswith(':connectionType')):
                    # A static XML token is NOT an arithmetic identifier. Do
                    # not invent variables for foreign/local technology names.
                    resolved[f['output']]=expr
                else:
                    try:resolved[f['output']]=_evaluate(expr,local)
                    except (ValueError,TypeError,ZeroDivisionError,SyntaxError,NameError):
                        # Constant technology tokens are not expressions.
                        if not f['inputs'] and re.fullmatch(r'[A-Z][A-Z0-9_/-]*',expr):
                            resolved[f['output']]=expr
                        else:
                            diagnostics.append({'code':'UNRESOLVED_FORMULA','factor':f['id'],'expression':expr})
                            status='unresolved'
        # Dynamic technology depends on current parameter values, not a constant
        # connector definition. Reject unknown technology before any snapshot.
        for f in self.graph.factors:
            if f['kind']!='formula' or not f['id'].endswith(':technology'):continue
            active_tech,activation_issue=self._active(f,domains)
            if active_tech is False:continue
            if activation_issue:continue
            selected=resolved.get(f['output'])
            if selected is None:
                diagnostics.append({'code':'TECHNOLOGY_NOT_RESOLVED','factor':f['id']})
                status='unresolved';continue
            definition=self.graph.library.technology(selected) if isinstance(selected,str) else None
            if definition is None:
                original = next((c for c in self.graph.entity.get('connectors', [])
                                 if c.get('id') == f['id'].split(':')[1]), None)
                external = original and (original.get('externalTechnologyRef') or
                                         original.get('technologyResolution'))
                # A library is a self-contained namespace and is legitimately
                # allowed to declare ZERO technologies. A foreign or unknown
                # connector technology may limit connector-specific rendering,
                # but it must not force the base C++ geometry to fail. NEVER
                # query a shared or cross-library technology registry.
                diagnostics.append({'code':'TECHNOLOGY_NOT_DEFINED_LOCALLY',
                                    'factor':f['id'], 'value':selected,
                                    'sourceRef':external,
                                    'severity':'warning','blocksSolve':False})
                continue
            size_name=definition.get('sizeTableName')
            matches=[g for g in definition.get('tableRefs',[]) if
                self.graph.library.table(g) is not None and
                self.graph.library.table(g).get('id')==size_name]
            if size_name and len(matches)!=1:
                diagnostics.append({'code':'TECH_SIZE_TABLE_AMBIGUOUS_OR_MISSING',
                                    'factor':f['id'],'technology':selected,'matches':matches,
                                    'severity':'warning','blocksSolve':False})
            elif size_name:
                # Re-activate only an explicitly bound table factor; never invent
                # the meaning of diameter columns in a new technology.
                connector_id=f['id'].split(':')[1]
                cs=f'connector/{eid}/{connector_id}'
                diameter=resolved.get(cs+'/diameter')
                bound_factors=[x for x in self.graph.factors if
                               x.get('kind')=='table' and x.get('tableGuid')==matches[0]]
                if not bound_factors:
                    diagnostics.append({'code':'TECH_SIZE_BINDING_UNVERIFIED',
                                        'factor':f['id'],'technology':selected,
                                        'tableGuid':matches[0], 'diameter':diameter,
                                        'severity':'warning','blocksSolve':False})
                elif diameter is not None:
                    # Only compare against columns actually bound to the connector
                    # diameter's source element variable (explicit DEF_ARGMAP).
                    source=f.get('sourceExpression')
                    original=next((c for c in self.graph.entity.get('connectors',[])
                                   if c.get('id')==connector_id),None)
                    diameter_var=(original or {}).get('diameterExpression')
                    node=_scope(eid,diameter_var) if diameter_var else None
                    matched=False
                    for factor in bound_factors:
                        for b in factor.get('bindings',[]):
                            if b['node']==node:
                                matched=True
                                allowed=self._matching_rows(matches[0],b['columnKey'],diameter)
                                if not allowed:
                                    diagnostics.append({'code':'TECH_DIAMETER_NOT_IN_TABLE',
                                        'factor':f['id'],'technology':selected,
                                        'diameter':diameter,'tableGuid':matches[0]})
                                    status='conflict'
                    if not matched:
                        diagnostics.append({'code':'TECH_SIZE_BINDING_UNVERIFIED',
                                          'factor':f['id'],'technology':selected,
                                          'tableGuid':matches[0], 'diameter':diameter,
                                          'severity':'warning','blocksSolve':False})
        snapshots={k.split('/')[-1]:v for k,v in resolved.items() if k.startswith(f'element/{eid}/')}
        # A valid ResolvedSnapshot requires all geometry input variables resolved;
        # otherwise keep the previous snapshot rather than publish stale dimensions.
        geo=self.graph.entity.get('geometry')
        geometry_requirements=set()
        for f in self.graph.factors:
            if f['kind']=='formula':
                geometry_requirements.update(f['inputs'])
        if self.graph.geometry_inputs is not None:
            geometry_requirements.update(_scope(eid,k) if '/' not in k else k
                                         for k in self.graph.geometry_inputs)
        opaque_geometry = isinstance(geo,dict) and geo.get('tag')=='DEF_GEOMETRY'
        ready=(status=='valid' and not any(d.get('blocksSolve',True) for d in diagnostics)
               and geometry_requirements.issubset(resolved)
               and (not opaque_geometry or self.graph.geometry_inputs is not None))
        snapshot={'values':resolved,'entityValues':snapshots} if ready else None
        if snapshot:self._last_valid_snapshot=snapshot
        options={n:list(v.values()) for n,v in all_supported.items()} if complete and status in ('valid','ambiguous') else {}
        active_restrictions=sorted(x for x in active if x.startswith('restriction:'))
        row_ids={k:sorted(v) for k,v in rows.items()}
        result={'status':status,'resolvedValues':resolved,
                'warnings':[x for x in diagnostics if not x.get('blocksSolve',True)],
                'validOptions':options,
                'defaultSuggestions':default_suggestions,
                'activeRestrictions':active_restrictions,
                'affectedGroups':sorted({'G'+str(i) for i,g in enumerate(self.graph.super_graph['groups'])
                                         if set(g['factorIds'])&affected}),
                'conflicts':[x for x in diagnostics if x.get('blocksSolve',True)],
                'resolvedSnapshot':snapshot,'lastValidSnapshot':self._last_valid_snapshot,
                'geometryReady':ready,
                'validRowIds':row_ids,
                '_domains':domains}
        self._previous=result;self._previous_pins=pins
        return result



def atomic_json_write(path, payload):
    import os
    import tempfile
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=str(path.parent),prefix='.'+path.name+'.',
                                         suffix='.tmp',delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary,path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def _first_difference(a, b, path='', level=0):
    if a == b:
        return None
    if level >= 30:
        return path, str(a)[:100], str(b)[:100]
    if isinstance(a, dict) and isinstance(b, dict):
        for k in a:
            if k not in b:
                return f'{path}/{k}', 'present', 'missing'
            if a[k] != b[k]:
                return _first_difference(a[k], b[k], f'{path}/{k}', level+1)
        for k in b:
            if k not in a:
                return f'{path}/{k}', 'missing', 'present'
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return path+'/length',len(a),len(b)
        for i,(x,y) in enumerate(zip(a,b)):
            if x != y:
                return _first_difference(x, y, f'{path}/{i}', level+1)
    return path, repr(a)[:120], repr(b)[:120]


def _same_or_fail(section, path, actual, expected):
    if actual != expected:
        mismatch = _first_difference(expected, actual, f'{section}/{path}')
        raise ValueError('CONVERTER_REFERENCE_MISMATCH: '+ str(mismatch))


def validate_xml_reference_links(xml_path, parsed):
    """Independently re-read XML relationships, then cross-check normalized JSON.

    This checks preservation of links, never whether an FLM restriction is
    satisfiable. XML source semantics are always authoritative.
    """
    root = ET.parse(xml_path).getroot()
    xml_tables = {guid(e): e for e in root.findall('FDESK_TABLE')}
    xml_entities = {guid(e): e for e in root.findall('FDESK_ENTITY')}
    json_entities = {e['guid']: e for e in parsed['entities'].values()}
    xml_folders = {guid(f): f for f in root.findall('FDESK_FOLDER')}
    counters = {'entities': 0, 'specifications': 0, 'restrictions': 0,
                'bindings': 0, 'tableReferences': 0, 'folderEntries': 0,
                'metadataTableReferences': 0, 'tableCells': 0,
                'localSpecificationReferences': 0,
                'nonlocalSpecificationReferences': 0, 'localFolderLinks': 0,
                'nonlocalFolderLinks': 0}
    for table_id, table in parsed['specifications'].items():
        source = xml_tables.get(table_id)
        if source is None:
            raise ValueError(f'CONVERTER_REFERENCE_MISMATCH: unknown table {table_id}')
        _same_or_fail('table', table_id, table['guid'], guid(source))
        spec = source.find('DEFSPEC')
        if spec is not None and spec.find('VALUE_DOUBLEARRAY') is not None:
            data = spec.find('VALUE_DOUBLEARRAY')
            _same_or_fail('table', table_id+'/column-count', len(table['columnStorage']), len(data.findall('VALUE_ARRAY')))
            _same_or_fail('table', table_id+'/row-count', len(table['rows']), int(data.get('COLS', '0')))
            _same_or_fail('table', table_id+'/columns', len(table['columns']), len(spec.findall('./NAMES/MLSTRING')))
            for ci, (storage, column) in enumerate(zip(table['columnStorage'],data.findall('VALUE_ARRAY'))):
                _same_or_fail('table', f'{table_id}/column-{ci}/TYPE', storage['typeCode'], scalar(column.get('TYPE')))
                # Complete typed values, VALUE_MAPs, and raw XML cell structures
                # must remain recoverable *before* compact packing.
                if storage['typeCode'] == 5 or 'rawValueNodes' in storage:
                    _same_or_fail('table', f'{table_id}/column-{ci}/rawNodes',
                                  storage.get('rawValueNodes'), [xml_tree(x) for x in column.findall('VALUE')])
            counters['tableCells'] += sum(len(row) for row in table['rows'])
        counters['specifications'] += 1

    for eid, entity in json_entities.items():
        raw = xml_entities.get(eid)
        if raw is None:
            raise ValueError(f'CONVERTER_REFERENCE_MISMATCH: unknown entity {eid}')
        counters['entities'] += 1
        original_rules = raw.findall('./DEF_ENTITY/DEF_LIMITLIST/DEF_LIMIT')
        _same_or_fail('entity', eid+'/restriction-count', len(entity['restrictions']), len(original_rules))
        _same_or_fail('entity', eid+'/tableRefs', entity.get('tableRefs', []),
                      [x.text for x in raw.findall('./TABLES/GUID')])
        counters['metadataTableReferences'] += len(entity.get('tableRefs', []))
        variables = raw.findall('./DEF_ENTITY/VARIABLE_DEFINITIONS/DEFINITIONS/DEF_VARIABLE')
        _same_or_fail('entity', eid+'/variable-count',len(entity['variables']),len(variables))
        for i,(src, exported) in enumerate(zip(variables, entity['variables'])):
            _same_or_fail('variable',f'{eid}/{i}/ID',exported['id'],src.get('ID'))
            _same_or_fail('variable',f'{eid}/{i}/VAL_TYPE',exported['valueTypeCode'],scalar(src.get('VAL_TYPE')))
            _same_or_fail('variable',f'{eid}/{i}/VAR_TYPE',exported['variableTypeCode'],scalar(src.get('VAR_TYPE')))
            _same_or_fail('variable',f'{eid}/{i}/option-count',len(exported['options']),len(src.findall('./OPTION_LIST/OPTION_PAIR')))
            _same_or_fail('variable',f'{eid}/{i}/default-count',len(exported['defaultValues']),len(src.findall('./DEFAULT_VALUES/DEFAULT_VALUE')))
        for i,(src, exported) in enumerate(zip(original_rules, entity['restrictions'])):
            counters['restrictions'] += 1
            _same_or_fail('restriction',f'{eid}/{i}/index',exported['index'],i)
            _same_or_fail('restriction',f'{eid}/{i}/GUID',exported.get('tableGuid'),guid(src))
            _same_or_fail('restriction',f'{eid}/{i}/TYPE',exported['typeCode'],scalar(src.get('TYPE')))
            _same_or_fail('restriction',f'{eid}/{i}/CND',exported['conditionsRaw'],condition_fields(src))
            original_bindings = src.findall('./DEF_ARGMAP/DEF_ARGMAPENTRY')
            _same_or_fail('restriction',f'{eid}/{i}/binding-count',len(exported['bindings']),len(original_bindings))
            if guid(src):
                counters['tableReferences'] += 1
                if guid(src) in xml_tables: counters['localSpecificationReferences'] += 1
                else: counters['nonlocalSpecificationReferences'] += 1
            for j,(raw_binding, binding) in enumerate(zip(original_bindings,exported['bindings'])):
                counters['bindings'] += 1
                for field, value in [('variable', raw_binding.findtext('VAR_NAME')),
                                     ('columnKey',scalar(raw_binding.get('KEY'))),
                                     ('levelCode',scalar(raw_binding.get('LEVEL'))),
                                     ('bindingTypeCode',scalar(raw_binding.get('TYPE')))]:
                    _same_or_fail('binding',f'{eid}/{i}/{j}/{field}',binding[field],value)
                if guid(src) in parsed['specifications']:
                    table = parsed['specifications'][guid(src)]
                    col = binding['columnKey']
                    if isinstance(col,int) and 0 <= col < len(table.get('columns',[])):
                        _same_or_fail('binding',f'{eid}/{i}/{j}/columnName',binding.get('columnName'),table['columns'][col])

    for entry in parsed['folders']:
        source = xml_folders.get(entry['guid'])
        if source is None:
            raise ValueError(f'CONVERTER_REFERENCE_MISMATCH: unknown folder {entry["guid"]}')
        original_entries = source.findall('FOLDER_ENTRY')
        _same_or_fail('folder',entry['guid']+'/entry-count',len(entry['entries']),len(original_entries))
        for idx,(jitem,xmlitem) in enumerate(zip(entry['entries'],original_entries)):
            _same_or_fail('folder',f'{entry["guid"]}/{idx}',jitem['guid'],guid(xmlitem))
            counters['folderEntries'] += 1
            if jitem['guid'] in xml_entities: counters['localFolderLinks'] += 1
            else: counters['nonlocalFolderLinks'] += 1
        _same_or_fail('folder',entry['guid']+'/tables',entry['tableRefs'],
                      [x.text for x in source.findall('./TABLES/GUID')])
    return counters


def compare_existing_technical_json(existing_path, normalized):
    """Verify current JSON against fresh XML without comparing log messages."""
    document = json.loads(Path(existing_path).read_text(encoding='utf-8'))
    if document.get('format') != 'FLM-PACK-1':
        raise ValueError('Expected optimized FLM-PACK-1 JSON for --compare-json')
    existing = unpack_library(document)
    # Diagnostics, log severity and source *filename* can legitimately differ.
    # Technical entities, tables, folders and technologies must match exactly.
    # Local-technology resolution notes are derived metadata, not XML source
    # fields; older converters used a misleading 'needs-shared-registry' status.
    # Compare original DEF_TECHID expression and any locally resolved GUID as-is.
    def xml_technical_entities(entities):
        import copy
        result = copy.deepcopy(entities)
        for entity in result.values():
            for connector in entity.get('connectors', []):
                connector.pop('externalTechnologyRef', None)
                connector.pop('technologyResolution', None)
        return result
    _same_or_fail('existing-json', 'entities',xml_technical_entities(existing.get('entities', {})),
                  xml_technical_entities(normalized.get('entities', {})))
    for section in ('specifications','technologies','folders'):
        _same_or_fail('existing-json',section, existing.get(section),normalized.get(section))
    if existing.get('source',{}).get('sha256') != normalized.get('source',{}).get('sha256'):
        raise ValueError('CONVERTER_REFERENCE_MISMATCH: original XML SHA256 differs from existing JSON')
    return True


def main():
    """Parse XML into packed library JSON with source-faithful graph metadata.

    --graph inspects one graph. --set invokes the conservative Python solver,
    which is not a replacement for the application runtime solver.
    """
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('source', nargs='?', type=Path, default=DEFAULT_XML_PATH,
                    help=f'Input .xml or packed .json (default: {DEFAULT_XML_PATH})')
    ap.add_argument('-o', '--output', type=Path,
                    help='Write JSON to this path; graph/solver print to stdout if omitted')
    ap.add_argument('--entity', help='Element symbol or GUID (required for graph/solve)')
    ap.add_argument('--indent', type=int, default=2)
    ap.add_argument('--compact', action='store_true', help='Compact expanded XML JSON (debug mode only)')
    ap.add_argument('--strict', action='store_true',
                    help='Strict CONVERSION fidelity; do not reject or rewrite XML source semantics')
    ap.add_argument('--check', action='store_true',
                    help='Validate XML/JSON conversion without writing a file')
    ap.add_argument('--compare-json', type=Path,
                    help='Compare existing optimized JSON to this XML (technical values and links)')
    ap.add_argument('--report', type=Path,
                    help='Save conversion/link audit as a JSON report')
    ap.add_argument('--show-runtime-notes', action='store_true',
                    help='Print individual runtime interpretation notes (normally summarized only)')
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument('--optimize', dest='optimize', action='store_true',
                      help='Pack and minify XML library JSON (default)')
    mode.add_argument('--no-optimize', dest='optimize', action='store_false',
                      help='Write expanded XML library JSON for debugging')
    ap.set_defaults(optimize=True)
    ap.add_argument('--graph', '--compile-graph', dest='graph', action='store_true',
                    help='Inspect compiled generic constraint graph for --entity')
    ap.add_argument('--focus', action='append', default=[], metavar='VARIABLE',
                    help='With --graph: show only required supergroups for a variable')
    ap.add_argument('--affected', action='append', default=[], metavar='VARIABLE',
                    help='With --graph: show groups affected by changing a variable')
    ap.add_argument('--no-graph-metadata', dest='graph_metadata', action='store_false',
                    help='Opt out of graph metadata in generated JSON (legacy clients)')
    ap.set_defaults(graph_metadata=True)
    ap.add_argument('--set', action='append', default=[], metavar='VARIABLE=VALUE',
                    help='Solve parameter update; may be repeated (e.g. --set d1=25)')
    ap.add_argument('--relation-code', action='append', default=[], metavar='CODE:OP',
                    help='Verified XML relation mapping, e.g. 3:eq')
    ap.add_argument('--limit-relation-code', action='append', default=[], metavar='CODE:OP',
                    help='Verified LIMIT/RELATION meaning, e.g. 3:eq, 1:ge (only when verified)')
    ap.add_argument('--geometry-input', action='append', default=None,
                    help='Verified geometry parameter; may be repeated')
    ap.add_argument('--max-search-nodes', type=int, default=30000,
                    help='Limit search space for solver (default: 30000)')
    args = ap.parse_args()
    if not args.source.is_file():
        ap.error(f'Input file not found: {args.source}')
    is_json = args.source.suffix.lower() == '.json'
    is_xml = args.source.suffix.lower() == '.xml'
    if not (is_xml or is_json):
        ap.error('Input file must be .xml or .json')
    if args.compact and args.optimize and not (args.graph or args.set):
        ap.error('--compact requires --no-optimize; optimized export is already compact')
    solving = bool(args.set)
    if args.focus and args.affected:
        ap.error('--focus and --affected cannot be used together')
    if (args.focus or args.affected) and not args.graph:
        ap.error('--focus/--affected require --graph')
    if (args.graph or solving) and (args.compare_json or args.report):
        ap.error('--compare-json/--report are for XML conversion, not --graph/--set')
    if args.graph and solving:
        ap.error('Use --graph OR --set, not both')
    if is_json and not (args.graph or solving):
        ap.error('Packed .json input requires --entity and --graph or --set')

    if args.graph or solving:
        if not args.entity:
            ap.error('--entity is required for --graph and --set')
        codes = {}
        for mapping in args.relation_code:
            try:
                code, op = mapping.split(':', 1)
                code = int(code)
            except ValueError:
                ap.error('Invalid --relation-code, expected CODE:OP')
            if op not in SUPPORTED_OPS:
                ap.error(f'Unknown relation operation: {op}')
            codes[code] = op
        if is_json:
            library = LazyLibrary(args.source)
        else:
            # Build the necessary library data in memory; no temporary graph
            # or expanded tables written to disk. Do not entity-filter here:
            # a technology used by this entity may reference shared tables.
            parsed = parse_library(args.source)
            normalized = optimized_library(parsed)
            library = LazyLibrary(_packed_encoder(normalized))
        limit_codes={}
        for mapping in args.limit_relation_code:
            try:
                code,op=mapping.split(':',1);code=int(code)
            except ValueError:ap.error('Invalid --limit-relation-code, expected CODE:OP')
            if op not in SUPPORTED_OPS:ap.error(f'Invalid LIMIT operation: {op}')
            limit_codes[code]=op
        if args.graph:
            result = graph_for_lazy_library(library, args.entity)
            if args.focus:
                result = {'graph':result, 'focus':graph_slice(result,args.focus,'requirements')}
            elif args.affected:
                result = {'graph':result, 'affected':graph_slice(result,args.affected,'affected')}
            graph_factor_count = len(result.get('factors',result['graph']['factors'])) if 'graph' in result else len(result['factors'])
            graph_group_count = len((result.get('graph') or result)['superGraph']['groups'])
        else:
            graph = CompiledConstraintGraph(library, args.entity, codes,
                                            geometry_inputs=args.geometry_input,
                                            limit_relation_codes=limit_codes)
            values = {}
            for assignment in args.set:
                if '=' not in assignment:
                    ap.error(f'Invalid --set {assignment!r}, expected NAME=VALUE')
                variable, raw = assignment.split('=', 1)
                if not variable:
                    ap.error('--set requires a nonempty variable')
                try:
                    values[variable] = json.loads(raw)
                except json.JSONDecodeError:
                    values[variable] = raw
            result = UnifiedConstraintSolver(graph, args.max_search_nodes).solve(values)
            result.pop('_domains', None)
        payload = json.dumps(result, ensure_ascii=False, indent=args.indent)
        if args.output:
            atomic_json_write(args.output, payload.encode('utf-8'))
            if args.graph:
                print(f'Wrote {args.output} | entity={args.entity} '
                      f'factors={graph_factor_count} groups={graph_group_count}')
            else:
                print(f'Wrote {args.output} | entity={graph.entity_key} '
                      f'factors={len(graph.factors)} groups={len(graph.super_graph["groups"])}')
        else:
            print(payload)
        return

    result = parse_library(args.source, args.entity)
    link_audit = validate_xml_reference_links(args.source, result)
    graph_audit = None
    if args.graph_metadata:
        graphs = compile_constraint_graph(result)
        graph_audit = validate_compiled_constraint_graphs(result, graphs)
        compact_graphs = compact_constraint_graphs(graphs)
        graph_packing_audit = validate_compact_constraint_graphs(graphs, compact_graphs)
        result['constraintGraphs'] = compact_graphs
        result['graphSchemaVersion'] = GRAPH_SCHEMA_VERSION
    # --strict is intentionally NOT a source-validity gate. Semantic compatibility
    # is reported, while byte/data fidelity is tested by validate_optimized().
    output = args.output or args.source.with_suffix('.json')
    if args.optimize:
        normalized = optimized_library(result)
        packed = _packed_encoder(normalized)
        validate_optimized(normalized, packed, original=result)
        if args.compare_json:
            compare_existing_technical_json(args.compare_json, normalized)
        data = json.dumps(packed, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        size = args.source.stat().st_size
        if len(data) >= size:
            print(f'WARNING: optimized JSON is larger than XML ({len(data)} >= {size}); '
                  'the validated result is still valid')
        if not args.check and not args.compare_json:
            atomic_json_write(output, data)
        print(f'MODE: OPTIMIZED (default) | VALIDATED: XML={size} bytes '
              f'JSON={len(data)} bytes ratio={len(data)/size:.3f}')
    else:
        if args.compact:
            result = compact_library(result)
        data = json.dumps(result, ensure_ascii=False, indent=args.indent)
        if json.loads(data) != result:
            raise ValueError('CONVERTER_FIDELITY_FAILURE: expanded JSON round trip changed data')
        if args.compare_json: ap.error('--compare-json requires optimized export')
        if not args.check:
            atomic_json_write(output, data.encode('utf-8'))
        print('MODE: EXPANDED (--no-optimize): size may exceed source XML')
    print(f'{"COMPARED" if args.compare_json else "VALIDATED" if args.check else "Wrote"} {args.compare_json if args.compare_json else output} | entities={len(result["entities"])} '
          f'tables={len(result["specifications"])} '
          f'technologies={len(result["technologies"])} '
          f'warnings={len(result["diagnostics"]["warnings"])} notices={len(result["diagnostics"].get("notices",[]))}')
    resolved = [c for e in result['entities'].values()
                for c in e.get('connectors', []) if c.get('technologyRef')]
    aliases = sum(c['technologyRef']['source'] != c['technologyRef']['id'] for c in resolved)
    print(f'REFERENCES: resolved_technology={len(resolved)} non_id_aliases={aliases} '
          f'missing_table_references={result["diagnostics"]["missingTableRefCount"]} '
          f'missing_table_guids={len(result["diagnostics"]["missingTableRefs"])}')
    print('CONVERSION VALIDATION: passed; XML authoritative;',
          len(result['diagnostics'].get('interpretationNotes', [])),
          'nonblocking runtime-interpretation note(s)')
    print('LINKS VERIFIED:',json.dumps(link_audit,ensure_ascii=False,sort_keys=True))
    if graph_audit:
        print('GRAPHS VERIFIED:',json.dumps(graph_audit,ensure_ascii=False,sort_keys=True))
        print('GRAPH PACKING VERIFIED:',json.dumps(graph_packing_audit,ensure_ascii=False,sort_keys=True))
    if args.compare_json: print('EXISTING JSON VERIFIED: technical fields identical to XML')
    if args.show_runtime_notes:
        for note in result['diagnostics'].get('interpretationNotes', []):
            print('RUNTIME NOTE:',json.dumps(note,ensure_ascii=False))
        for notice in result['diagnostics'].get('notices', []):
            print('SOURCE NOTICE:',notice)
    for warning in result['diagnostics']['warnings'][:12]:
        print('WARNING:', warning)
    if args.report:
        audit = {'source':result['source'], 'links':link_audit,
                 'warnings':result['diagnostics']['warnings'],
                 'constraintGraph':graph_audit,
                 'graphPacking':graph_packing_audit if graph_audit else None,
                 'notices':result['diagnostics'].get('notices',[]),
                 'runtimeNotes':result['diagnostics'].get('interpretationNotes',[]),
                 'comparedJSON': str(args.compare_json) if args.compare_json else None}
        atomic_json_write(args.report,json.dumps(audit,indent=2,ensure_ascii=False).encode('utf-8'))
        print('AUDIT REPORT:',args.report)


if __name__ == '__main__':
    main()
