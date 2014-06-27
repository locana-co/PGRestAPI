#!/usr/bin/env python

import os
import sys
import json
import mapnik

if not mapnik.mapnik_version() > 200100:
    print 'Error: this script is only designed to work with Mapnik 2.1 and above (you have %s)' % mapnik.mapnik_version_string()
    sys.exit(1)

mapnik_version = mapnik.mapnik_version_string().replace('-pre','')

reference_file = './%s/reference.json' % mapnik_version
if not os.path.exists(reference_file):
    print '\n*** WARNING *** reference.json not found for your mapnik version (%s), defaulting to latest\n' % mapnik_version
    reference_file = './latest/reference.json'

reference = json.load(open(reference_file, 'r'))

type_mapping = {
    'integer':'int',
    'float':'float',
    'unsigned':'int',
    'boolean':'bool',
    'uri':'str',
    'string':'str',
    'color':'mapnik.Color',
    'expression':'mapnik.Expression',
    'functions':'todo'
}

style = mapnik.Style()
for prop in reference['style'].items():
    key = prop[0].replace('-','_')
    assert hasattr(style,key), "'%s' not a valid property of Style" % key

layer = mapnik.Layer('foo')
for prop in reference['layer'].items():
    key = prop[0].replace('-','_')
    assert hasattr(layer,key), "'%s' not a valid property of Layer" % key


map_instance = mapnik.Map(256,256)
for prop in reference['symbolizers']['map'].items():
    key = prop[0].replace('-','_')
    # https://github.com/mapnik/mapnik/issues/1419
    if not key in ['minimum_version','paths_from_xml','font_directory']:
        assert hasattr(map_instance,key), "'%s' not a valid property of Map" % key

# https://github.com/mapnik/mapnik/issues/1427
text_fixups = {
  'size':'text_size',
  'opacity':'text_opacity',
  'spacing':'label_spacing',
  'max_char_angle_delta':'maximum_angle_char_delta',
  'placement':'label_placement'
}

total_fails = 0
before = 0
for sym in reference['symbolizers'].items():
    if sym[0] not in ['map','*']:
    #if sym[0] in ['raster']:
        sym_name = ''.join([s.title() for s in sym[0].split('-')])
        sym_object = getattr(mapnik,sym_name+'Symbolizer')
        instance_var = None
        if sym_name in ['PolygonPattern','LinePattern']:
            instance_var = sym_object(mapnik.PathExpression(''))
        elif sym_name == 'Shield':
            instance_var = sym_object(mapnik.Expression('True'),'DejaVu Sans Book', 10, mapnik.Color('black'), mapnik.PathExpression(''))
        else:
            instance_var = sym_object()
        fails = []
        for prop in sym[1]:
            key = prop.replace('-','_')
            if key == 'file':
                key = 'filename'
            if sym_name == 'Line' and 'stroke' in key:
                stroke_instance = instance_var.stroke
                if key == 'stroke':
                    key = 'color'
                else:
                   key = key.replace('stroke_','')
                if not hasattr(stroke_instance,key):
                    fails.append("'%s' not a valid property of %s" % (key,'Stroke'))
            elif sym_name == 'Markers' and 'stroke' in key:
                stroke_instance = instance_var.stroke
                if not stroke_instance: # marker.stroke is boost::optional
                    stroke_instance = mapnik.Stroke()
                if key == 'stroke':
                    key = 'color'
                else:
                   key = key.replace('stroke_','')
                if not hasattr(stroke_instance,key):
                    fails.append("'%s' not a valid property of %s" % (key,'Stroke'))
            else:
                # temporary hotfix until: https://github.com/mapnik/mapnik/issues/1427
                if sym_name in ['Text','Shield']:
                    if key in text_fixups:
                        key = text_fixups[key]
                if not hasattr(instance_var,key):
                    fails.append("'%s' not a valid property of %s" % (key,sym_name))
                else:
                    attr_instance = getattr(instance_var,key)
                    prop_type = sym[1][prop]['type']
                    if not isinstance(prop_type,list):
                        mapnik_py_type = type_mapping[prop_type]
                        # TODO - make mapnik.Expression ctor a proper class
                        if attr_instance is None:
                            continue
                        if mapnik_py_type == 'mapnik.Expression':
                            #expected_expr = "<type 'Boost.Python.function'>"
                            expected_expr = "<class 'mapnik._mapnik.Expression'>"
                            if not str(type(attr_instance)) == expected_expr:
                                print 'type error: %s for %s/%s is not %s (ex' % (type(attr_instance),sym_name,key)
                        elif prop_type == 'functions':
                            pass
                        else:
                            if not isinstance(attr_instance,eval(mapnik_py_type)):
                                #print sym[1][prop]
                                print 'type error: %s (actual) for %s/%s is not %s (expected)' % (type(attr_instance),sym_name,key,eval(mapnik_py_type))
        if len(fails):
            print '\n\n%s -->\n' % (sym_name)
            for f in fails:
                print f
            #print '(' + '|'.join([i for i in dir(instance_var) if not '__' in i]) + ')'
        total_fails += len(fails);

print '\n\nTotal issues: %s' % total_fails
