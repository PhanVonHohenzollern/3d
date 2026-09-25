export const kVertexShader = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec3 aNormal;

uniform mat4 uMvp;
uniform mat3 uNormalMatrix;

out vec3 vColor;
out vec3 vNormal;

void main()
{
    vColor = aColor;
    vNormal = uNormalMatrix * aNormal;
    gl_Position = uMvp * vec4(aPosition, 1.0);
}
`;

export const kFragmentShader = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;

uniform bool uUseOverrideColor;
uniform vec3 uOverrideColor;
uniform bool uLightingEnabled;
uniform float uOpacity;

out vec4 fragColor;

void main()
{
    vec3 base = uUseOverrideColor ? uOverrideColor : vColor;
    if (uLightingEnabled && dot(vNormal, vNormal) > 1e-10) {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        vec3 keyLight = normalize(vec3(-0.45, 0.75, 1.0));
        vec3 fillLight = normalize(vec3(0.8, -0.25, 0.6));
        float key = max(dot(normal, keyLight), 0.0);
        float fill = max(dot(normal, fillLight), 0.0);
        float brightness = 0.50 + 0.40 * key + 0.10 * fill;
        base *= brightness;
    }
    fragColor = vec4(base, uOpacity);
}
`;

// Every GL_LINES draw is a screen-space quad, clipped to the view volume here. Native WebGL
// lines are clamped to 1 px, and ANGLE drops or mis-rasterizes segments that cross the near
// plane or reach far outside the viewport (the world axes vanished at the default camera).
export const kLineQuadVertexShader = `#version 300 es
layout(location = 0) in vec3 aPositionA;
layout(location = 1) in vec3 aPositionB;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec2 aCorner;

uniform mat4 uMvp;
uniform vec2 uViewport;
uniform float uLineWidth;

out vec3 vColor;

bool clipPlane(float d0, float d1, inout float t0, inout float t1)
{
    if (d0 < 0.0 && d1 < 0.0) return false;
    if (d0 < 0.0) t0 = max(t0, d0 / (d0 - d1));
    else if (d1 < 0.0) t1 = min(t1, d0 / (d0 - d1));
    return t0 <= t1;
}

void main()
{
    vColor = aColor;
    vec4 a = uMvp * vec4(aPositionA, 1.0);
    vec4 b = uMvp * vec4(aPositionB, 1.0);

    const float margin = 1.05;
    float t0 = 0.0;
    float t1 = 1.0;
    bool visible = clipPlane(a.w + a.z, b.w + b.z, t0, t1)
        && clipPlane(a.w - a.z, b.w - b.z, t0, t1)
        && clipPlane(margin * a.w + a.x, margin * b.w + b.x, t0, t1)
        && clipPlane(margin * a.w - a.x, margin * b.w - b.x, t0, t1)
        && clipPlane(margin * a.w + a.y, margin * b.w + b.y, t0, t1)
        && clipPlane(margin * a.w - a.y, margin * b.w - b.y, t0, t1);
    if (!visible) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    vec4 ca = mix(a, b, t0);
    vec4 cb = mix(a, b, t1);

    vec2 halfViewport = 0.5 * uViewport;
    vec2 sa = ca.xy / ca.w * halfViewport;
    vec2 sb = cb.xy / cb.w * halfViewport;
    vec2 direction = sb - sa;
    float len = length(direction);
    direction = len > 1e-6 ? direction / len : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    vec4 position = aCorner.x < 0.5 ? ca : cb;
    position.xy += normal * (aCorner.y * 0.5 * uLineWidth) / halfViewport * position.w;
    gl_Position = position;
}
`;

export const kLineQuadFragmentShader = `#version 300 es
precision highp float;
in vec3 vColor;

uniform bool uUseOverrideColor;
uniform vec3 uOverrideColor;

out vec4 fragColor;

void main()
{
    fragColor = vec4(uUseOverrideColor ? uOverrideColor : vColor, 1.0);
}
`;
