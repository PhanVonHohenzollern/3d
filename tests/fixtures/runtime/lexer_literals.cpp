// Numeric literal forms, int/double classification, strings and comments.
//@line 40
//@line 12
//@eval a + i
//@eval p
//@eval 0x10
//@eval 1.5f * 2
int a = 42;
double b = 3.25;
double c = .5;
double d = 1.;
double e = 1e3;
double f = 2.5E-2;
float g = 1.5f;
long h = 10L;
int i = 0x1F;
int j = 0x10L;
int k = 0xFFu;
double l = 7UL;
double m = 1.e2;
double n = 017;
double o = 1e+2;
double p = 0x1p3;
double q = 12e;
double r = 3.0L + 1e5L + 100u;
int big = 9007199254740993;
int X1 = 0X1A;
double hexf = 0xABCf;
double doubleSuffix = 1.5ff;
int zx = 0x;
char *s1 = "a\tb\n\"q\"\\ \x";
char c1 = 'x';
char c2 = '\'';
char *utf = "é°";
double u = 5 | 3;
double @v = 1; // unknown punctuation is ignored
double w = 2 ^ 3;
/* block comment
   spanning lines */ double afterComment = 1;
double tail = a /* inline */ + 1; // trailing
double last = 2; /* unterminated comment at end of file;
