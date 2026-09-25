import { collectRecordsByTag, collectScalarsByTag, findByTag, parseXml, xmlText } from "./arca-xml";

describe("xmlText", () => {
  it("convierte escalares como String()", () => {
    expect(xmlText("CAE")).toBe("CAE");
    expect(xmlText(10016)).toBe("10016");
    expect(xmlText(true)).toBe("true");
  });

  it("devuelve vacío para un valor ausente", () => {
    expect(xmlText(undefined)).toBe("");
    expect(xmlText(null)).toBe("");
  });

  it("une las listas con coma y deja los nodos compuestos como String()", () => {
    expect(xmlText([1, "dos", null])).toBe(String([1, "dos", null]));
    expect(xmlText({ Id: 1 })).toBe("[object Object]");
  });
});

describe("findByTag", () => {
  const root = parseXml("<a><b><Code>600</Code></b><Code>601</Code></a>");

  it("prefiere el tag del nivel actual antes de bajar a los hijos", () => {
    expect(findByTag(root, "Code")).toBe(601);
  });

  it("baja a los hijos cuando el nivel actual no tiene el tag", () => {
    expect(findByTag(parseXml("<a><b><Code>600</Code></b></a>"), "Code")).toBe(600);
  });

  it("devuelve undefined si el tag no existe", () => {
    expect(findByTag(root, "Msg")).toBeUndefined();
  });
});

describe("collectRecordsByTag", () => {
  it("junta los nodos compuestos con el tag, sean uno o varios", () => {
    const root = parseXml(
      "<r><Moneda><Id>PES</Id></Moneda><x><Moneda><Id>DOL</Id></Moneda><Moneda><Id>EUR</Id></Moneda></x></r>",
    );

    expect(collectRecordsByTag(root, "Moneda")).toEqual([{ Id: "PES" }, { Id: "DOL" }, { Id: "EUR" }]);
  });

  it("ignora las apariciones escalares del tag", () => {
    expect(collectRecordsByTag(parseXml("<r><Moneda>PES</Moneda></r>"), "Moneda")).toEqual([]);
  });
});

describe("collectScalarsByTag", () => {
  it("junta los valores escalares del tag como texto, en orden", () => {
    const root = parseXml("<r><Code>1</Code><x><Code>2</Code><Code>3</Code></x><Code><y/></Code></r>");

    expect(collectScalarsByTag(root, "Code")).toEqual(["1", "2", "3"]);
  });
});
