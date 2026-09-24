// Scalar declarations, initializers and redeclaration lifetimes.
//@line 999
//@line 5
//@line 20
double a;
int b;
float c;
short d = 3.9;
long e = -2.5;
bool f;
bool g = 5;
bool h = 0.0;
char *s;
const char *cs = "const";
char ch;
const double k = 3, l = k * 2, mm;
double &r = a;
double *ptr;
volatile int vol = 7;
const volatile double cv = 1.5;
double x(5);
int y(2.7);
bool z(3);
double empty();
int two(1, 2);
double fromBool = true;
int fromBool2 = false;
double a = 10;
double chained = a = 4;
double p = 1, q = p + 1, r2 = q * q;
int arr2 = 3, *pp, &rr = arr2;
ads_real ar = 2.5;
ads_real arCast = 3;
FLM3Geo::primitiveMode pm = FLM3Geo::pmExtInsulation;
primitiveMode pm2 = primitiveMode::pmIntInsulation;
line_type lt = 2.9;
double tail x;
double braces{1};
