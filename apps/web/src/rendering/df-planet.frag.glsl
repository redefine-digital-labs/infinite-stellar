#version 300 es
// Dark Forest Round 5 PlanetProgram + required ShaderMixins. MIT, (c) 2022 0xPARC.
// Pinned d1e25ead311697ecaa27ff648dac16a0d8cea15c. See public/third-party/df-renderer-LICENSE.txt.
// Adaptation: expanded template includes; clamp spherical square roots outside the disk.
#define PI 3.1415926535


    precision highp float;
    in vec4 v_position;
    in vec4 v_color;
    in vec4 v_color2;
    in vec4 v_color3;
    in vec2 v_rectPos;
    in float v_seed;
    in float v_eps;
    in float v_alpha;
    in float v_distort;

    in float v_octaves;
    in float v_numClouds;
    in float v_morphSpeed;
    in float v_showBeach;

    uniform mat4 u_timeMatrix;
    uniform float u_time;

    out vec4 outColor;


    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

    vec4 grad4(float j, vec4 ip){
      const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
      vec4 p,s;

      p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
      p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
      s = vec4(lessThan(p, vec4(0.0)));
      p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

      return p;
    }

    float snoise(vec4 v){
      const vec2  C = vec2( 0.138196601125010504,  // (5 - sqrt(5))/20  G4
                            0.309016994374947451); // (sqrt(5) - 1)/4   F4
      // First corner
      vec4 i  = floor(v + dot(v, C.yyyy) );
      vec4 x0 = v -   i + dot(i, C.xxxx);

      // Other corners

      // Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
      vec4 i0;

      vec3 isX = step( x0.yzw, x0.xxx );
      vec3 isYZ = step( x0.zww, x0.yyz );
      i0.x = isX.x + isX.y + isX.z;
      i0.yzw = 1.0 - isX;

      i0.y += isYZ.x + isYZ.y;
      i0.zw += 1.0 - isYZ.xy;

      i0.z += isYZ.z;
      i0.w += 1.0 - isYZ.z;

      // i0 now contains the unique values 0,1,2,3 in each channel
      vec4 i3 = clamp( i0, 0.0, 1.0 );
      vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
      vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

      //  x0 = x0 - 0.0 + 0.0 * C
      vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
      vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
      vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
      vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;

      // Permutations
      i = mod(i, 289.0);
      float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
      vec4 j1 = permute( permute( permute( permute (
                i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
              + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
              + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
              + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

      // Gradients
      // ( 7*7*6 points uniformly over a cube, mapped onto a 4-octahedron.)
      // 7*7*6 = 294, which is close to the ring size 17*17 = 289.

      vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

      vec4 p0 = grad4(j0,   ip);
      vec4 p1 = grad4(j1.x, ip);
      vec4 p2 = grad4(j1.y, ip);
      vec4 p3 = grad4(j1.z, ip);
      vec4 p4 = grad4(j1.w, ip);

      // Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      p4 *= taylorInvSqrt(dot(p4,p4));

      // Mix contributions from the five corners
      vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
      vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
      m0 = m0 * m0;
      m1 = m1 * m1;
      return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
                  + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;
    }


    float seededRandom(float s) {
      return fract(sin(s) * 7626.1234);
    }


    vec4 blend(vec4 fg, vec4 bg) {
      vec3 cOut = fg.rgb * fg.a + bg.rgb * bg.a * (1. - fg.a);
      float aOut = fg.a + bg.a * (1. - fg.a);

      return vec4(cOut, aOut);
    }


    float arcTan(float y, float x) {
      float arcT = atan(y, x); // [-Pi, Pi]
      float vertical = y > 0. ? PI / 2. : PI / -2.; // deal with discontinuity at x = 0
      float thetaOffset = x == 0. ? vertical : arcT;
      float theta = thetaOffset + PI; // [0, 2 * Pi]

      return theta;
    }


    float r = 1.0;
    float inR = 0.9;

    // returns [rho, theta, phi]
    vec3 getSpherical(vec3 coords) {
      float x = coords.x; float y = coords.y; float z = coords.z;
      float rho = length(coords);

      float theta = arcTan(y, x);
      float phi = acos(z / rho);

      return vec3(rho, theta, phi);
    }


    // f([x, y, z]) -> [0, 1]
    float blobFn(vec3 coords) {
      float distort = v_distort;
      vec4 rot = u_timeMatrix * vec4(coords, 1.);
      float n = snoise(vec4(rot.xyz * 1.5, u_time * (1.2 - 8. * distort)));
      return (1. - distort) + distort * n;
    }

    float blobAtSpherical(float rho, float theta, float phi) {
      float x = rho * sin(phi) * cos(theta);
      float y = rho * sin(phi) * sin(theta);
      float z = rho * cos(phi);

      return blobFn(vec3(x, y, z));
    }

    // add shadow to a bg color
    vec4 getShadow(vec4 bg) {
      float shadowDist = length(v_rectPos - vec2(-0.35, -0.25));
      bool isShadow = shadowDist > pow(1.05, 2.0);
      vec4 shadowColor = isShadow ? vec4(vec3(0.0), 0.3) : vec4(0.0);
      return blend(shadowColor, bg);
    }

    // give an x, y, z in noise space and it returns a color
    vec4 getTerrainColor(vec3 tCoords, float offW) {
      float offX = seededRandom(v_seed) * 8376.0;
      float offY = seededRandom(v_seed * 2.0) * 8376.0;
      float offZ = seededRandom(v_seed * 3.0) * 8376.0;

      vec3 nIn3 = tCoords * 1.43 + vec3(offX, offY, offZ);
      vec4 nIn = vec4(nIn3, offW);

      float n = 0.;
      for (float i = 0.; i < v_octaves; i += 1.) {
        float fac = pow(2.0, i);
        n += snoise(nIn * fac) * (1. / fac);
      }

      vec4 withBeach = n > 0.16 ? v_color : v_color3;
      vec4 landColor = (v_showBeach > 0.) ? withBeach : v_color;

      vec4 beachColor2 = vec4(vec3(v_color3.rgb + v_color2.rgb) * 0.8, 1.);
      vec4 withBeach2 = n < -0.16 ? v_color2 : beachColor2;
      vec4 waterColor = (v_showBeach > 1.) ? withBeach2 : v_color2;

      vec4 colorAt = n > 0. ? landColor : waterColor;

      return colorAt;
    }

    bool isPlanet(float r, float theta) {
      float limit = blobAtSpherical(1., theta, PI / 2.);
      return r < limit;
      // return pow(x, 2.) + pow(y, 2.) < 1.;
    }

    vec4 getPlanetColor(float xPre, float yPre, float offW) {
      /* do transformations */
      float xNorm = xPre * (1. / inR);
      float yNorm = yPre * (1. / inR);
      float zNorm = sqrt(max(0., 1. - pow(xNorm, 2.0) - pow(yNorm, 2.0)));
      vec3 normalized = vec3(xNorm, yNorm, zNorm);

      /* from now on we are always in normalized [0, 1] land */

      // vec4 preImage = vec4(xPre, yPre, pZ, 1.0);
      // vec4 image = u_timeMatrix * preImage;
      vec4 rot = u_timeMatrix * vec4(normalized, 1.);
      vec3 image = rot.xyz;

      /* recover spherical coords + polar */
      vec3 spherical = getSpherical(normalized);
      float rho = spherical.x; // should always be 1
      float theta = spherical.y;
      float phi = spherical.z;
      float r = length(vec2(xNorm, yNorm));

      float morph = blobAtSpherical(rho, theta, phi);

      // get terrain color
      vec4 terrainColor = getTerrainColor(image.xyz * morph, offW);

      // check if it should be inside or not
      bool isPlanet = isPlanet(r, theta);

      // filter out the stuff that's not inside
      vec4 planetColor = isPlanet ? terrainColor : vec4(0.0);

      // finally, apply shadow
      return getShadow(planetColor);
    }

    vec4 getCloudColor(float xPre, float yPre, float cloudIdx) {
      float noiseW = cloudIdx * 0.2;

      float cZ = sqrt(max(0., r - pow(xPre, 2.0) - pow(yPre, 2.0)));
      vec4 cPre = vec4(xPre, yPre, cZ, 1.0);

      mat4 myMatrix = u_timeMatrix;

      for (float i = 0.; i < cloudIdx * 0.5; i++) {
        myMatrix = myMatrix * u_timeMatrix;
      }

      vec4 cImage = myMatrix * cPre;
      vec3 cIn3 = cImage.xyz / 1.2;
      cIn3.y = cIn3.y * 5.0;

      float w = v_seed + noiseW /*+ u_time*/;
      float cn1 = snoise(vec4(cIn3, w));
      float cn2 = snoise(vec4(cIn3 * 2.0, w)) * 0.5;

      float cn = cn1 + cn2;

      vec4 cloudColor = cn > 0.5 ? vec4(vec3(1.0), 0.7) : vec4(0.0);

      bool isIn = length(v_rectPos) <= r;

      return isIn ? cloudColor : vec4(0.0);
    }

    void main() {
      float xPre = v_rectPos.x;
      float yPre = v_rectPos.y;

      // planet stuff
      vec4 planetColor = getPlanetColor(xPre, yPre, u_time * v_morphSpeed);

      // do antialiasing
      float ratio = (inR - length(v_rectPos)) / v_eps;

      if (ratio < 1.) {
        planetColor.a *= ratio;
      }

      // calculate cloud stuff
      vec4 myColor = planetColor;
      for (float i = 0.; i < v_numClouds; i += 1.) {
        vec4 cloudColor = getCloudColor(xPre, yPre, i);
        myColor = blend(cloudColor, myColor);
      }

      // discard fragments for depth buffer sorting
      if (myColor.a < 0.5) discard; // clouds look slightly funky but whatever

      myColor.a *= v_alpha;
      outColor = myColor;
    }
