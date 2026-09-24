// Static discovery of get_val parameters, independent of the cursor.
//@line 3
//@line 9
//@line 999
//@param Diameter=80
void configure(double width, int n = 4, bool open = true, char *label = "L", float f = -2.5)
{
    get_val("Width", width);
    get_val("N", n);
    get_val("Open", open);
    get_val("Label", label);
    get_val("F", f);
}

void other()
{
    get_val("Diameter", diameter);
    double diameter = 100;
    short s = +3;
    long lg = 0x20;
    ads_real real = 1.5e3;
    const double cst = (1 + 2);
    double arr[2] = {1, 2};
    double braced = f({1, 2});
    double dx({1});
    get_val("Braced", braced);
    get_val("Dx", dx);
    get_val("Short", s);
    get_val("Long", lg);
    get_val("Real", real);
    get_val("Const", cst);
    get_val("Arr", arr[1]);
    get_val("Expr", arr[0] + 1);
    get_val("Unknown", nothing);
    get_val("Width", width);
    get_val("Width", width);
    get_val(name, width);
    get_val("A", "B");
    get_val("Three", a, b);
    get_val("Nested", f(g(1), 2));
    get_val("Unclosed", x
}
