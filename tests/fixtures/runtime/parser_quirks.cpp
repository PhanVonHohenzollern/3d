// Statement splitting quirks: missing ';', stray braces, empty statements.
//@line 999
//@line 5
//@line 12
double a = 1;
double b = 2
double c = 3;
;;
{
    double d = 4;
    { double e = 5; }
}
}
double f = a + b;
{ double g = 6 }
double h = 7;
if (a) { double i = 8 } double j = 9;
double k = 10;
foo(a,
    b,
    c);
double m = a +
    b +
    c;
double lastWithoutSemicolon = 11
