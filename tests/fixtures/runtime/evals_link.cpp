// evaluateNumericExpression against the final state (Link fields).
//@param Height=320
//@eval Height
//@eval Height * 0.5
//@eval H
//@eval  H 
//@eval W
//@eval widths[1]
//@eval p.x + v.y
//@eval p
//@eval flag
//@eval name
//@eval FLM3Geo::pmExtInsulation
//@eval FLM3Geo::primitiveMode::pmExtInsulation
//@eval HALF(H)
//@eval H /
//@eval 1e999
//@eval -1e999
//@eval getExtInsSize(H)
//@eval nothing * 2
//@eval cpx + M_PI
//@eval vx.x
//@eval 0x20 + 1.5e1
//@eval local
#define HALF(x) ((x) / 2)
double H = 100;
double W = 50;
double widths[2] = {W, W * 2};
FdPoint3d p(1, 2, 3);
FdVector3d v(4, 5, 6);
bool flag = true;
char *name = "abc";
get_val("Height", H);
get_val("Width", W);
get_val("W2", widths[1]);
void fn()
{
    double local = 3;
}
