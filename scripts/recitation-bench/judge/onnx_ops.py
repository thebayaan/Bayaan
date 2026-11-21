"""Lists what an ONNX file needs from a runtime: IR version, opsets, operators,
inputs and outputs. Reads the protobuf by hand, so it needs no package and runs
nothing from the file.

    python3 -I judge/onnx_ops.py <model.onnx> [<other.onnx>]
"""
import collections
import json
import sys


def varint(buf, i):
    out = shift = 0
    while True:
        b = buf[i]
        i += 1
        out |= (b & 0x7F) << shift
        if not b & 0x80:
            return out, i
        shift += 7


def fields(buf):
    """Yields (field number, wire type, value); length-delimited values as memoryview."""
    i = 0
    n = len(buf)
    while i < n:
        key, i = varint(buf, i)
        num, wire = key >> 3, key & 7
        if wire == 0:
            val, i = varint(buf, i)
        elif wire == 1:
            val = bytes(buf[i : i + 8])
            i += 8
        elif wire == 2:
            size, i = varint(buf, i)
            val = buf[i : i + size]
            i += size
        elif wire == 5:
            val = bytes(buf[i : i + 4])
            i += 4
        else:
            raise ValueError(f'wire type {wire}')
        yield num, wire, val


def value_info(buf):
    name = None
    for num, _, val in fields(buf):
        if num == 1:
            name = bytes(val).decode()
    return name


def graph(buf, ops):
    inputs, outputs = [], []
    inits = 0
    for num, _, val in fields(buf):
        if num == 1:  # node
            domain = ''
            op = None
            for n2, _, v2 in fields(val):
                if n2 == 4:
                    op = bytes(v2).decode()
                elif n2 == 7:
                    domain = bytes(v2).decode()
                elif n2 == 5:  # attribute: subgraphs of If and Loop
                    for n3, _, v3 in fields(v2):
                        if n3 == 6:
                            graph(v3, ops)
            ops[(domain, op)] += 1
        elif num == 5:
            inits += 1
        elif num == 11:
            inputs.append(value_info(val))
        elif num == 12:
            outputs.append(value_info(val))
    return inputs, outputs, inits


def describe(path):
    with open(path, 'rb') as f:
        buf = memoryview(f.read())
    out = {'file': path.split('/')[-1], 'opsets': {}, 'meta': {}, 'bytes': len(buf)}
    ops = collections.Counter()
    for num, _, val in fields(buf):
        if num == 1:
            out['ir'] = val
        elif num == 8:
            domain = ''
            version = None
            for n2, _, v2 in fields(val):
                if n2 == 1:
                    domain = bytes(v2).decode()
                elif n2 == 2:
                    version = v2
            out['opsets'][domain] = version
        elif num == 2:
            out['producer'] = bytes(val).decode()
        elif num == 14:
            k = v = None
            for n2, _, v2 in fields(val):
                if n2 == 1:
                    k = bytes(v2).decode()
                elif n2 == 2:
                    v = bytes(v2).decode()
            out['meta'][k] = v
        elif num == 7:
            inputs, outputs, inits = graph(val, ops)
            out['inputs'] = inputs
            out['outputs'] = outputs
            out['initializers'] = inits
    out['ops'] = {f'{d}:{o}' if d else o: c for (d, o), c in sorted(ops.items(), key=lambda x: str(x[0]))}
    return out


def main():
    results = [describe(p) for p in sys.argv[1:]]
    print(json.dumps(results, indent=1, ensure_ascii=False))
    if len(results) == 2:
        a, b = set(results[0]['ops']), set(results[1]['ops'])
        print('in the first, not in the second:', sorted(a - b))


if __name__ == '__main__':
    main()
