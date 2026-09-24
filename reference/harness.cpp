// Reference harness: runs the ORIGINAL C++ runtime/geometry code (../../runtime,
// ../../geometry) on a fixture and prints every observable output as JSON.
// tests/support/dump.ts produces the same document from the TypeScript port;
// the differential tests compare the two.
//
// Fixture directives (C++ comments, any line):
//   //@line N            cursor line to execute to (repeatable; default: last line)
//   //@param key=value   GeometryRuntime::setParameters entry (repeatable)
//   //@eval expression   evaluateNumericExpression after each run (repeatable)
//   //@connector type|orientation|diameter|a|b|x,y,z|a,b,g[|name|point]
//                        buildConnectorPreview after each run (repeatable)
//                        type: Circular|Rectangular; orientation: XPositive..ZNegative

#include <cmath>
#include <cstdio>
#include <fstream>
#include <functional>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#include "geometry/ConnectorPreview.h"
#include "geometry/PreviewGeometryEngine.h"
#include "runtime/ApiMetadata.h"
#include "runtime/ApiSemantics.h"
#include "runtime/DebugAnchorResolver.h"
#include "runtime/GeometryRuntime.h"

namespace {

class Json
{
public:
    std::string str() const { return m_out.str(); }

    Json &raw(const std::string &s) { m_out << s; return *this; }
    Json &string(const std::string &s)
    {
        m_out << '"';
        for (unsigned char c : s) {
            switch (c) {
            case '"': m_out << "\\\""; break;
            case '\\': m_out << "\\\\"; break;
            case '\n': m_out << "\\n"; break;
            case '\r': m_out << "\\r"; break;
            case '\t': m_out << "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof buf, "\\u%04x", c);
                    m_out << buf;
                } else {
                    m_out << c;
                }
            }
        }
        m_out << '"';
        return *this;
    }
    Json &number(double v, int precision = 17)
    {
        if (std::isnan(v)) return string("nan");
        if (std::isinf(v)) return string(v < 0 ? "-inf" : "inf");
        char buf[40];
        std::snprintf(buf, sizeof buf, "%.*g", precision, v);
        m_out << buf;
        return *this;
    }
    Json &integer(long long v) { m_out << v; return *this; }
    Json &boolean(bool v) { m_out << (v ? "true" : "false"); return *this; }
    Json &null() { m_out << "null"; return *this; }

private:
    std::ostringstream m_out;
};

// Writes `[a, b, ...]` using `each(json, element)`.
template <typename Range, typename Fn>
void list(Json &j, const Range &range, Fn each)
{
    j.raw("[");
    bool first = true;
    for (const auto &element : range) {
        if (!first) j.raw(",");
        first = false;
        each(j, element);
    }
    j.raw("]");
}

void strings(Json &j, const std::vector<std::string> &values)
{
    list(j, values, [](Json &j, const std::string &s) { j.string(s); });
}

void xyz(Json &j, double x, double y, double z)
{
    j.raw("[").number(x).raw(",").number(y).raw(",").number(z).raw("]");
}

void value(Json &j, const RuntimeValue &v)
{
    if (std::holds_alternative<std::monostate>(v)) { j.raw("{\"t\":\"unset\"}"); return; }
    if (const auto *d = std::get_if<double>(&v)) { j.raw("{\"t\":\"d\",\"v\":").number(*d).raw("}"); return; }
    if (const auto *i = std::get_if<std::int64_t>(&v)) { j.raw("{\"t\":\"i\",\"v\":").string(std::to_string(*i)).raw("}"); return; }
    if (const auto *b = std::get_if<bool>(&v)) { j.raw("{\"t\":\"b\",\"v\":").boolean(*b).raw("}"); return; }
    if (const auto *s = std::get_if<std::string>(&v)) { j.raw("{\"t\":\"s\",\"v\":").string(*s).raw("}"); return; }
    if (const auto *p = std::get_if<FdPoint3d>(&v)) { j.raw("{\"t\":\"p\",\"v\":"); xyz(j, p->x, p->y, p->z); j.raw("}"); return; }
    if (const auto *q = std::get_if<FdVector3d>(&v)) { j.raw("{\"t\":\"v\",\"v\":"); xyz(j, q->x, q->y, q->z); j.raw("}"); return; }
    const auto &a = std::get<RuntimeArrayPtr>(v);
    if (!a) { j.raw("{\"t\":\"a\",\"null\":true}"); return; }
    j.raw("{\"t\":\"a\",\"elementType\":").string(a->elementType).raw(",\"dimensions\":");
    list(j, a->dimensions, [](Json &j, std::size_t d) { j.integer(static_cast<long long>(d)); });
    j.raw(",\"elements\":");
    list(j, a->elements, [](Json &j, const RuntimeValue &e) { value(j, e); });
    j.raw("}");
}

void source(Json &j, const RuntimeValueSource &s)
{
    j.raw("{\"name\":").string(s.name).raw(",\"value\":");
    value(j, s.value);
    j.raw(",\"variableId\":").integer(s.variableId)
        .raw(",\"historyEnd\":").integer(static_cast<long long>(s.historyEnd)).raw("}");
}

void trace(Json &j, const RuntimeArgumentTrace &t)
{
    j.raw("{\"expression\":").string(t.expression).raw(",\"sources\":");
    list(j, t.sources, source);
    j.raw(",\"elements\":");
    list(j, t.elements, trace);
    j.raw("}");
}

void parameterRequest(Json &j, const RuntimeParameterRequest &r)
{
    j.raw("{\"name\":").string(r.name)
        .raw(",\"type\":").string(r.type)
        .raw(",\"defaultValue\":").string(r.defaultValue)
        .raw(",\"currentValue\":").string(r.currentValue)
        .raw(",\"sourceFunction\":").string(r.sourceFunction)
        .raw(",\"variableName\":").string(r.variableName)
        .raw(",\"line\":").integer(r.line).raw("}");
}

void apiCall(Json &j, const RuntimeApiCall &c)
{
    j.raw("{\"line\":").integer(c.line)
        .raw(",\"parentApiIndex\":").integer(c.parentApiIndex)
        .raw(",\"userFunctionCall\":").boolean(c.userFunctionCall)
        .raw(",\"name\":").string(c.name)
        .raw(",\"arguments\":");
    list(j, c.arguments, value);
    j.raw(",\"argumentTexts\":");
    list(j, c.arguments, [](Json &j, const RuntimeValue &v) { j.string(runtimeValueToString(v)); });
    j.raw(",\"argumentTypes\":");
    list(j, c.arguments, [](Json &j, const RuntimeValue &v) { j.string(runtimeTypeName(v)); });
    j.raw(",\"argumentExpressions\":"); strings(j, c.argumentExpressions);
    j.raw(",\"formalParameterNames\":"); strings(j, c.formalParameterNames);
    j.raw(",\"formalParameterTypes\":"); strings(j, c.formalParameterTypes);
    j.raw(",\"display\":").string(c.display).raw(",\"argumentTraces\":");
    list(j, c.argumentTraces, trace);
    j.raw("}");
}

void result(Json &j, const RuntimeResult &r)
{
    j.raw("{\"variables\":");
    list(j, r.variables, [](Json &j, const RuntimeVariable &v) {
        j.raw("{\"name\":").string(v.name).raw(",\"value\":");
        value(j, v.value);
        j.raw(",\"text\":").string(runtimeValueToString(v.value))
            .raw(",\"type\":").string(runtimeTypeName(v.value))
            .raw(",\"lastChangedLine\":").integer(v.lastChangedLine).raw("}");
    });
    j.raw(",\"variableChanges\":");
    list(j, r.variableChanges, [](Json &j, const RuntimeVariableChange &c) {
        j.raw("{\"line\":").integer(c.line)
            .raw(",\"name\":").string(c.name)
            .raw(",\"operation\":").string(c.operation)
            .raw(",\"expression\":").string(c.expression)
            .raw(",\"before\":");
        value(j, c.before);
        j.raw(",\"after\":");
        value(j, c.after);
        j.raw(",\"variableId\":").integer(c.variableId).raw(",\"sources\":");
        list(j, c.sources, source);
        j.raw("}");
    });
    j.raw(",\"diagnostics\":");
    list(j, r.diagnostics, [](Json &j, const RuntimeDiagnostic &d) {
        j.raw("{\"line\":").integer(d.line).raw(",\"message\":").string(d.message).raw("}");
    });
    j.raw(",\"apiCalls\":");
    list(j, r.apiCalls, apiCall);
    j.raw(",\"parameterRequests\":");
    list(j, r.parameterRequests, parameterRequest);
    j.raw("}");
}

const char *bindingName(ApiAnchorBinding b)
{
    switch (b) {
    case ApiAnchorBinding::None: return "None";
    case ApiAnchorBinding::First: return "First";
    case ApiAnchorBinding::Last: return "Last";
    case ApiAnchorBinding::SameIndex: return "SameIndex";
    case ApiAnchorBinding::EveryPoint: return "EveryPoint";
    }
    return "?";
}

const char *meaningName(ApiArrayMeaning m)
{
    switch (m) {
    case ApiArrayMeaning::Values: return "Values";
    case ApiArrayMeaning::Sections: return "Sections";
    case ApiArrayMeaning::Endpoints: return "Endpoints";
    case ApiArrayMeaning::ControlPoints: return "ControlPoints";
    case ApiArrayMeaning::Vertices: return "Vertices";
    }
    return "?";
}

void callInfo(Json &j, const RuntimeApiCall &call)
{
    const auto &all = allNativeApiSignatures();
    const ApiSignatureMetadata *sig = apiSignatureMetadataForCall(call);
    j.raw("{\"signature\":").integer(sig ? static_cast<long long>(sig - all.data()) : -1);
    j.raw(",\"parameterNames\":");
    list(j, apiParameterMetadataForCall(call), [](Json &j, const ApiParameterMetadata &p) { j.string(p.name); });

    const auto semantics = apiSemanticsForCall(call);
    j.raw(",\"semantics\":");
    list(j, semantics, [](Json &j, const ApiParameterSemantics &s) {
        j.raw("{\"role\":").string(s.role)
            .raw(",\"anchorParameter\":").string(s.anchorParameter)
            .raw(",\"anchorBinding\":").string(bindingName(s.anchorBinding))
            .raw(",\"arrayMeaning\":").string(meaningName(s.arrayMeaning))
            .raw(",\"countParameter\":").string(s.countParameter)
            .raw(",\"countOffset\":").integer(s.countOffset)
            .raw(",\"fixedCount\":").integer(s.fixedCount)
            .raw(",\"output\":").boolean(s.output)
            .raw(",\"elementRoles\":");
        strings(j, s.elementRoles);
        j.raw("}");
    });

    // Per actual argument: role, used element count and per-element roles.
    j.raw(",\"parameters\":[");
    for (std::size_t i = 0; i < call.arguments.size(); ++i) {
        if (i) j.raw(",");
        std::size_t available = 0;
        if (const auto *a = std::get_if<RuntimeArrayPtr>(&call.arguments[i]); a && *a) available = (*a)->elements.size();
        j.raw("{\"role\":").string(apiParameterRole(call, i)).raw(",\"usedCount\":");
        if (i < semantics.size()) j.integer(static_cast<long long>(apiUsedElementCount(call, semantics[i], available)));
        else j.null();
        j.raw(",\"elementRoles\":[");
        for (std::size_t e = 0; e < std::min<std::size_t>(available, 24); ++e) {
            if (e) j.raw(",");
            j.string(apiParameterRole(call, i, {e}));
        }
        j.raw("]}");
    }
    j.raw("]");

    j.raw(",\"points\":");
    list(j, resolveDebugPointSnapshots(call), [](Json &j, const DebugPointSnapshot &p) {
        j.raw("{\"name\":").string(p.name).raw(",\"point\":");
        xyz(j, p.point.x, p.point.y, p.point.z);
        j.raw(",\"role\":").string(p.role).raw("}");
    });
    j.raw(",\"vectors\":");
    list(j, resolveDebugVectorAnchors(call), [](Json &j, const DebugVectorAnchor &v) {
        j.raw("{\"sourceName\":").string(v.sourceName)
            .raw(",\"parameterName\":").string(v.parameterName)
            .raw(",\"anchor\":");
        xyz(j, v.anchor.x, v.anchor.y, v.anchor.z);
        j.raw(",\"direction\":");
        xyz(j, v.direction.x, v.direction.y, v.direction.z);
        j.raw(",\"role\":").string(v.role).raw("}");
    });
    j.raw("}");
}

void collectHistories(Json &j, const RuntimeResult &r, const RuntimeArgumentTrace &t, bool &first)
{
    for (const auto &s : t.sources) {
        if (!first) j.raw(",");
        first = false;
        list(j, runtimeSourceHistory(r, s), [](Json &j, std::size_t i) { j.integer(static_cast<long long>(i)); });
    }
    for (const auto &e : t.elements) collectHistories(j, r, e, first);
}

void mesh(Json &j, const PreviewMesh &m)
{
    j.raw("{\"apiIndex\":").integer(m.apiIndex)
        .raw(",\"sourceLine\":").integer(m.sourceLine)
        .raw(",\"apiName\":").string(m.apiName)
        .raw(",\"color\":[").number(m.color.r, 9).raw(",").number(m.color.g, 9).raw(",").number(m.color.b, 9)
        .raw("],\"vertices\":[");
    bool first = true;
    for (const auto &v : m.vertices) {
        for (float f : {v.x, v.y, v.z, v.nx, v.ny, v.nz}) {
            if (!first) j.raw(",");
            first = false;
            j.number(f, 9);
        }
    }
    j.raw("],\"indices\":");
    list(j, m.indices, [](Json &j, std::uint32_t i) { j.integer(i); });
    j.raw("}");
}

void scene(Json &j, const PreviewGeometryScene &s)
{
    j.raw("{\"meshes\":");
    list(j, s.meshes, mesh);
    j.raw(",\"warnings\":");
    strings(j, s.warnings);
    j.raw("}");
}

std::vector<std::string> split(const std::string &s, char separator)
{
    std::vector<std::string> parts;
    std::string current;
    for (char c : s) {
        if (c == separator) { parts.push_back(current); current.clear(); }
        else current.push_back(c);
    }
    parts.push_back(current);
    return parts;
}

std::string trimmed(const std::string &s)
{
    const auto b = s.find_first_not_of(" \t\r");
    if (b == std::string::npos) return {};
    const auto e = s.find_last_not_of(" \t\r");
    return s.substr(b, e - b + 1);
}

ConnectorDefinition parseConnector(const std::string &spec, int id)
{
    const auto f = split(spec, '|');
    if (f.size() < 7) throw std::runtime_error("bad //@connector directive: " + spec);
    ConnectorDefinition d;
    d.id = id;
    d.type = trimmed(f[0]) == "Rectangular" ? ConnectorType::Rectangular : ConnectorType::Circular;
    const std::vector<std::string> orientations {"XPositive", "XNegative", "YPositive", "YNegative", "ZPositive", "ZNegative"};
    for (std::size_t i = 0; i < orientations.size(); ++i)
        if (trimmed(f[1]) == orientations[i]) d.orientation = static_cast<ConnectorOrientation>(i);
    d.diameter = trimmed(f[2]);
    d.aSize = trimmed(f[3]);
    d.bSize = trimmed(f[4]);
    const auto position = split(f[5], ',');
    const auto angles = split(f[6], ',');
    for (std::size_t i = 0; i < 3; ++i) {
        if (i < position.size()) d.position[i] = trimmed(position[i]);
        if (i < angles.size()) d.angles[i] = trimmed(angles[i]);
    }
    if (f.size() > 7) d.name = trimmed(f[7]);
    if (f.size() > 8) d.pointName = trimmed(f[8]);
    return d;
}

void connector(Json &j, const ConnectorPreview &c)
{
    j.raw("{\"id\":").integer(c.id)
        .raw(",\"name\":").string(c.name)
        .raw(",\"pointName\":").string(c.pointName)
        .raw(",\"point\":");
    xyz(j, c.point.x, c.point.y, c.point.z);
    j.raw(",\"direction\":");
    xyz(j, c.direction.x, c.direction.y, c.direction.z);
    j.raw(",\"up\":");
    xyz(j, c.up.x, c.up.y, c.up.z);
    j.raw(",\"length\":").number(c.length).raw(",\"meshes\":");
    list(j, c.meshes, mesh);
    j.raw(",\"outline\":");
    list(j, c.outline, [](Json &j, const std::pair<FdPoint3d, FdPoint3d> &segment) {
        j.raw("[");
        xyz(j, segment.first.x, segment.first.y, segment.first.z);
        j.raw(",");
        xyz(j, segment.second.x, segment.second.y, segment.second.z);
        j.raw("]");
    });
    j.raw("}");
}

} // namespace

int main(int argc, char **argv)
{
    if (argc != 2) {
        std::cerr << "usage: harness <fixture.cpp>\n";
        return 2;
    }
    std::ifstream in(argv[1], std::ios::binary);
    if (!in) {
        std::cerr << "cannot read " << argv[1] << "\n";
        return 2;
    }
    std::stringstream buffer;
    buffer << in.rdbuf();
    const std::string code = buffer.str();

    std::vector<int> lines;
    std::unordered_map<std::string, std::string> parameters;
    std::vector<std::string> evals;
    std::vector<ConnectorDefinition> connectors;
    int lineCount = 0;
    {
        std::istringstream text(code);
        std::string line;
        while (std::getline(text, line)) {
            ++lineCount;
            const auto at = line.find("//@");
            if (at == std::string::npos) continue;
            const std::string directive = line.substr(at + 3);
            const auto space = directive.find(' ');
            const std::string key = directive.substr(0, space);
            const std::string rest = space == std::string::npos ? std::string{} : trimmed(directive.substr(space + 1));
            if (key == "line") lines.push_back(std::stoi(rest));
            else if (key == "param") {
                const auto eq = rest.find('=');
                parameters[rest.substr(0, eq)] = eq == std::string::npos ? std::string{} : rest.substr(eq + 1);
            } else if (key == "eval") evals.push_back(rest);
            else if (key == "connector") connectors.push_back(parseConnector(rest, static_cast<int>(connectors.size()) + 1));
        }
    }
    if (lines.empty()) lines.push_back(lineCount);

    Json j;
    GeometryRuntime runtime;
    j.raw("{\"discoverParameters\":");
    list(j, runtime.discoverParameters(code), parameterRequest);
    j.raw(",\"runs\":[");
    for (std::size_t run = 0; run < lines.size(); ++run) {
        if (run) j.raw(",");
        runtime.setParameters(parameters);
        const RuntimeResult r = runtime.executeUpToLine(code, lines[run]);
        j.raw("{\"line\":").integer(lines[run]).raw(",\"result\":");
        result(j, r);
        j.raw(",\"callInfo\":");
        list(j, r.apiCalls, callInfo);
        j.raw(",\"sourceHistories\":[");
        bool first = true;
        for (const auto &call : r.apiCalls)
            for (const auto &t : call.argumentTraces) collectHistories(j, r, t, first);
        j.raw("],\"scene\":");
        scene(j, PreviewGeometryEngine().build(r));
        j.raw(",\"evals\":");
        list(j, evals, [&](Json &j, const std::string &expression) {
            j.raw("{\"expression\":").string(expression).raw(",");
            try {
                const double v = runtime.evaluateNumericExpression(expression);
                j.raw("\"value\":").number(v).raw(",\"error\":null}");
            } catch (const std::exception &e) {
                j.raw("\"value\":null,\"error\":").string(e.what()).raw("}");
            }
        });
        j.raw(",\"connectors\":");
        list(j, connectors, [&](Json &j, const ConnectorDefinition &d) {
            try {
                const ConnectorPreview preview = buildConnectorPreview(d, [&](const std::string &expression) {
                    return runtime.evaluateNumericExpression(expression);
                });
                j.raw("{\"preview\":");
                connector(j, preview);
                j.raw(",\"error\":null}");
            } catch (const std::exception &e) {
                j.raw("{\"preview\":null,\"error\":").string(e.what()).raw("}");
            }
        });
        j.raw("}");
    }
    j.raw("]}");
    std::cout << j.str() << "\n";
    return 0;
}
