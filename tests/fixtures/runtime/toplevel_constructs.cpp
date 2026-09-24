// Top-level constructs outside the subset: prototypes, classes, namespaces.
//@line 999
//@line 9
void proto(double a);
class Shape { public: double w; };
struct Pt { double x, y; };
enum Color { Red, Green };
namespace ns { double inner = 3; }
double afterNs = 4;
using namespace std;
int main(int argc, char **argv) const
{
    double local = argc + 1;
    proto(local);
    makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(local, 0, 0), 1, 1, 3);
}
static inline void helper(void)
{
    makeSimpleTube(FdPoint3d(1, 0, 0), FdPoint3d(2, 0, 0), 1, 1, 3);
}
void proto(double a)
{
    helper();
    double b = a;
}
