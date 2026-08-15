const fs = require('fs');

const METADATA_PROPS_FIELD = 14;
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_64BIT = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_32BIT = 5;

function readVarint(buffer, pos) {
  let result = 0n;
  let shift = 0n;
  let cursor = pos;
  while (true) {
    const byte = buffer[cursor];
    cursor += 1;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, cursor];
}

function* iterateFields(buffer, start, end) {
  let pos = start;
  while (pos < end) {
    const [tag, tagEnd] = readVarint(buffer, pos);
    pos = tagEnd;
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 7n);

    if (wireType === WIRE_TYPE_VARINT) {
      const [value, next] = readVarint(buffer, pos);
      pos = next;
      yield { fieldNumber, wireType, value };
    } else if (wireType === WIRE_TYPE_64BIT) {
      yield { fieldNumber, wireType, value: buffer.subarray(pos, pos + 8) };
      pos += 8;
    } else if (wireType === WIRE_TYPE_LENGTH_DELIMITED) {
      const [len, next] = readVarint(buffer, pos);
      pos = next;
      const value = buffer.subarray(pos, pos + Number(len));
      pos += Number(len);
      yield { fieldNumber, wireType, value };
    } else if (wireType === WIRE_TYPE_32BIT) {
      yield { fieldNumber, wireType, value: buffer.subarray(pos, pos + 4) };
      pos += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wireType} (field ${fieldNumber})`);
    }
  }
}

function readOnnxMetadataProps(onnxPath) {
  const buffer = fs.readFileSync(onnxPath);
  const props = {};
  for (const field of iterateFields(buffer, 0, buffer.length)) {
    if (field.fieldNumber !== METADATA_PROPS_FIELD || field.wireType !== WIRE_TYPE_LENGTH_DELIMITED) continue;
    let key = '';
    let value = '';
    for (const sub of iterateFields(field.value, 0, field.value.length)) {
      if (sub.fieldNumber === 1) key = Buffer.from(sub.value).toString('utf8');
      if (sub.fieldNumber === 2) value = Buffer.from(sub.value).toString('utf8');
    }
    props[key] = value;
  }
  return props;
}

module.exports = { readOnnxMetadataProps };
